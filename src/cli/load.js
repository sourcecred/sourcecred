// @flow
// Implementation of `sourcecred load`.

import mkdirp from "mkdirp";
import path from "path";
import chalk from "chalk";

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import * as RepoIdRegistry from "../core/repoIdRegistry";
import {repoIdToString, stringToRepoId, type RepoId} from "../core/repoId";
import dedent from "../util/dedent";
import type {Command} from "./command";
import * as Common from "./common";
import {Graph} from "../core/graph";
import {loadGraph, type LoadGraphResult} from "../analysis/loadGraph";
import {type IBackendAdapterLoader} from "../analysis/analysisAdapter";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {defaultWeights, fromJSON as weightsFromJSON} from "../analysis/weights";

import execDependencyGraph from "../tools/execDependencyGraph";
import {loadGithubData} from "../plugins/github/loadGithubData";
import {loadGitData} from "../plugins/git/loadGitData";
import {defaultAdapterLoaders} from "./pagerank";
import {DEFAULT_CRED_CONFIG} from "../plugins/defaultCredConfig";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred load [REPO_ID...] [--output REPO_ID]
                           [--plugin PLUGIN]
                           [--help]

    Load a repository's data into SourceCred.

    Each REPO_ID refers to a GitHub repository in the form OWNER/NAME: for
    example, torvalds/linux.

    Arguments:
        REPO_ID...
            Repositories for which to load data.

        --output REPO_ID
            Store the data under the name of this repository. When
            loading multiple repositories, this can be the name of an
            aggregate repository. For instance, if loading data for
            repositories 'foo/bar' and 'foo/baz', the output name might
            be 'foo/combined'.

            If only one repository is given, the output defaults to that
            repository. Otherwise, an output must be specified.

        --plugin PLUGIN
            Plugin for which to load data. Valid options are 'git' and
            'github'. If not specified, data for all default plugins will be
            loaded.

        --weights WEIGHTS_FILE
            Path to a json file which contains a weights configuration.
            This will be used instead of the default weights and persisted.

        --help
            Show this help message and exit, as 'sourcecred help load'.

    Environment variables:
        SOURCECRED_GITHUB_TOKEN
            API token for GitHub. This should be a 40-character hex
            string. Required if using the GitHub plugin; ignored
            otherwise.

            To generate a token, create a "Personal access token" at
            <https://github.com/settings/tokens>. When loading data for
            public repositories, no special permissions are required.
            For private repositories, the 'repo' scope is required.

        SOURCECRED_DIRECTORY
            Directory owned by SourceCred, in which data, caches,
            registries, etc. are stored. Optional: defaults to a
            directory 'sourcecred' under your OS's temporary directory;
            namely:
                ${Common.defaultSourcecredDirectory()}
    `.trimRight()
  );
}

function die(std, message) {
  std.err("fatal: " + message);
  std.err("fatal: run 'sourcecred help load' for help");
  return 1;
}

export type LoadOptions = {|
  +output: RepoId,
  +repoIds: $ReadOnlyArray<RepoId>,
  +weightsPath?: string,
|};

export function makeLoadCommand(
  loadIndividualPlugin: (Common.PluginName, LoadOptions) => Promise<void>,
  loadDefaultPlugins: (LoadOptions) => Promise<void>
): Command {
  return async function load(args, std) {
    if (Common.githubToken() == null) {
      // TODO(#638): This check should be abstracted so that plugins can
      // specify their argument dependencies and get nicely formatted
      // errors.
      // For simplicity, for now while we are always using GitHub, we just
      // check for the GitHub token upfront for all load commands.
      return die(std, "no GitHub token specified");
    }

    const repoIds: RepoId[] = [];
    let explicitOutput: RepoId | null = null;
    let plugin: Common.PluginName | null = null;
    let weightsPath: ?string;

    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case "--help": {
          usage(std.out);
          return 0;
        }
        case "--output": {
          if (explicitOutput != null)
            return die(std, "'--output' given multiple times");
          if (++i >= args.length)
            return die(std, "'--output' given without value");
          explicitOutput = stringToRepoId(args[i]);
          break;
        }
        case "--weights": {
          if (weightsPath != undefined)
            return die(std, "'--weights' given multiple times");
          if (++i >= args.length)
            return die(std, "'--weights' given without value");
          weightsPath = args[i];
          break;
        }
        case "--plugin": {
          if (plugin != null)
            return die(std, "'--plugin' given multiple times");
          if (++i >= args.length)
            return die(std, "'--plugin' given without value");
          const arg = args[i];
          if (arg !== "git" && arg !== "github")
            return die(std, "unknown plugin: " + JSON.stringify(arg));
          plugin = arg;
          break;
        }
        default: {
          // Should be a repository.
          repoIds.push(stringToRepoId(args[i]));
          break;
        }
      }
    }

    let output: RepoId;
    if (explicitOutput != null) {
      output = explicitOutput;
    } else if (repoIds.length === 1) {
      output = repoIds[0];
    } else {
      return die(std, "output repository not specified");
    }

    const options: LoadOptions = {output, repoIds: repoIds, weightsPath};

    if (plugin == null) {
      try {
        await loadDefaultPlugins(options);
        return 0;
      } catch (e) {
        std.err(e.message);
        return 1;
      }
    } else {
      try {
        await loadIndividualPlugin(plugin, options);
        return 0;
      } catch (e) {
        std.err(e.message);
        return 1;
      }
    }
  };
}

export type SaveGraph = (
  $ReadOnlyArray<IBackendAdapterLoader>,
  RepoId
) => Promise<Graph>;

export type SaveCred = (
  graph: Graph,
  repoId: RepoId,
  weightsPath?: string
) => Promise<void>;

/**
 * A wrapper around the default plugin loader.
 *
 * We wrap so that we can dependency inject saveGraph for testability.
 * (saveGraph depends on the directory state that's generated by running
 * load.)
 */
export const makeLoadDefaultPlugins = (
  saveGraph: SaveGraph,
  saveCred: SaveCred
) => {
  return async (options: LoadOptions) => {
    const sourcecredCommand = (args) => [
      process.execPath,
      "--max_old_space_size=8192",
      process.argv[1],
      ...args,
    ];
    const tasks = [
      ...Common.defaultPlugins.map((pluginName) => ({
        id: `load-${pluginName}`,
        cmd: sourcecredCommand([
          "load",
          ...options.repoIds.map((repoId) => repoIdToString(repoId)),
          "--output",
          repoIdToString(options.output),
          "--plugin",
          pluginName,
        ]),
        deps: [],
      })),
    ];

    const {success: loadSuccess} = await execDependencyGraph(tasks, {
      taskPassLabel: "DONE",
    });
    if (!loadSuccess) {
      throw new Error("Load tasks failed.");
    }
    addToRepoIdRegistry(options.output);
    const graph = await saveGraph(defaultAdapterLoaders(), options.output);
    await saveCred(graph, options.output, options.weightsPath);
    return;
  };
};

const loadWeightOverrides = async (path: string) => {
  if (!(await fs.exists(path))) {
    throw new Error("Could not find the weights file");
  }

  const raw = await fs.readFile(path, "utf-8");
  return weightsFromJSON(JSON.parse(raw));
};

export const saveCred = async (
  graph: Graph,
  repoId: RepoId,
  weightsPath?: string
) => {
  const id = "compute-cred";
  console.time(id);
  // Imitate the task labels from execDependencyGraph for visual consistency
  console.log(chalk.bgBlue.bold.white("  GO  ") + ` ${id}`);

  // Get the weights if applicable.
  let weights = defaultWeights();
  if (weightsPath) {
    weights = await loadWeightOverrides(weightsPath);
  }

  const cred = await TimelineCred.compute(
    graph,
    {
      alpha: 0.05,
      intervalDecay: 0.5,
      weights,
    },
    DEFAULT_CRED_CONFIG
  );
  const credFile = path.join(
    Common.sourcecredDirectory(),
    "data",
    repoIdToString(repoId),
    "cred.json"
  );
  const credJSON = cred.toJSON();
  await fs.writeFile(credFile, JSON.stringify(credJSON));
  const badge = chalk.bgGreen.bold.white(" DONE ");
  console.log(`${badge} ${id}`);
  console.timeEnd(id);
};

export const loadIndividualPlugin = async (
  plugin: Common.PluginName,
  options: LoadOptions
) => {
  const {output, repoIds} = options;
  function scopedDirectory(key) {
    const directory = path.join(
      Common.sourcecredDirectory(),
      key,
      repoIdToString(output),
      plugin
    );
    mkdirp.sync(directory);
    return directory;
  }
  const outputDirectory = scopedDirectory("data");
  const cacheDirectory = scopedDirectory("cache");
  switch (plugin) {
    case "github": {
      const token = Common.githubToken();
      if (token == null) {
        throw new Error("no SOURCECRED_GITHUB_TOKEN set");
      }
      await loadGithubData({token, repoIds, outputDirectory, cacheDirectory});
      return;
    }
    case "git":
      await loadGitData({repoIds, outputDirectory, cacheDirectory});
      return;
    // Unlike the previous check, which was validating user input and
    // was reachable, this really should not occur.
    // istanbul ignore next
    default:
      throw new Error("unknown plugin: " + JSON.stringify((plugin: empty)));
  }
};

function addToRepoIdRegistry(repoId) {
  // TODO: Make this function transactional before loading repositories in
  // parallel.
  const oldRegistry = RepoIdRegistry.getRegistry(Common.sourcecredDirectory());
  const newRegistry = RepoIdRegistry.addEntry(oldRegistry, {repoId});
  RepoIdRegistry.writeRegistry(newRegistry, Common.sourcecredDirectory());
}

/**
 * Load the graph (really generate it by merging from the plugins) and then save to disk.
 * Modify with caution.
 */
export async function saveGraph(
  adapterLoaders: $ReadOnlyArray<IBackendAdapterLoader>,
  repoId: RepoId
): Promise<Graph> {
  const loadGraphResult: LoadGraphResult = await loadGraph(
    Common.sourcecredDirectory(),
    adapterLoaders,
    repoId
  );
  if (loadGraphResult.status !== "SUCCESS") {
    throw new Error(`Unable to load graph: ${stringify(loadGraphResult)}`);
  }
  const {graph} = loadGraphResult;
  const graphFile = path.join(
    Common.sourcecredDirectory(),
    "data",
    repoIdToString(repoId),
    "graph.json"
  );
  const graphJSON = graph.toJSON();
  await fs.writeFile(graphFile, stringify(graphJSON));
  return graph;
}

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

const loadDefaultPlugins = makeLoadDefaultPlugins(saveGraph, saveCred);
const load = makeLoadCommand(loadIndividualPlugin, loadDefaultPlugins);

export default load;
