// @flow
// Implementation of `sourcecred load`.

import fs from "fs";
import stringify from "json-stable-stringify";
import mkdirp from "mkdirp";
import path from "path";

import * as RepoIdRegistry from "../core/repoIdRegistry";
import {repoIdToString, stringToRepoId, type RepoId} from "../core/repoId";
import dedent from "../util/dedent";
import type {Command} from "./command";
import * as Common from "./common";

import execDependencyGraph from "../tools/execDependencyGraph";
import {loadGithubData} from "../plugins/github/loadGithubData";
import {loadGitData} from "../plugins/git/loadGitData";

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
            'github'. If not specified, data for all plugins will be
            loaded.

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

const load: Command = async (args, std) => {
  const repoIds = [];
  let explicitOutput: RepoId | null = null;
  let plugin: Common.PluginName | null = null;
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
      case "--plugin": {
        if (plugin != null) return die(std, "'--plugin' given multiple times");
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

  if (plugin == null) {
    return loadDefaultPlugins({std, output, repoIds});
  } else {
    return loadPlugin({std, output, repoIds, plugin});
  }
};

const loadDefaultPlugins = async ({std, output, repoIds}) => {
  if (Common.githubToken() == null) {
    // TODO(#638): This check should be abstracted so that plugins can
    // specify their argument dependencies and get nicely formatted
    // errors.
    return die(std, "no GitHub token specified");
  }

  const tasks = [
    ...Common.defaultPlugins().map((pluginName) => ({
      id: `load-${pluginName}`,
      cmd: [
        process.execPath,
        "--max_old_space_size=8192",
        process.argv[1],
        "load",
        ...repoIds.map((repoId) => repoIdToString(repoId)),
        "--output",
        repoIdToString(output),
        "--plugin",
        pluginName,
      ],
      deps: [],
    })),
  ];

  const {success} = await execDependencyGraph(tasks, {taskPassLabel: "DONE"});
  if (success) {
    addToRepoIdRegistry(output);
  }
  return success ? 0 : 1;
};

const loadPlugin = async ({std, output, repoIds, plugin}) => {
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
        // TODO(#638): This check should be abstracted so that plugins
        // can specify their argument dependencies and get nicely
        // formatted errors.
        return die(std, "no GitHub token specified");
      }
      await loadGithubData({token, repoIds, outputDirectory, cacheDirectory});
      return 0;
    }
    case "git":
      await loadGitData({repoIds, outputDirectory, cacheDirectory});
      return 0;
    // Unlike the previous check, which was validating user input and
    // was reachable, this really should not occur.
    // istanbul ignore next
    default:
      return die(std, "unknown plugin: " + JSON.stringify((plugin: empty)));
  }
};

function addToRepoIdRegistry(repoId) {
  // TODO: Make this function transactional before loading repositories in
  // parallel.
  const outputFile = path.join(
    Common.sourcecredDirectory(),
    RepoIdRegistry.REPO_ID_REGISTRY_FILE
  );
  let registry = null;
  if (fs.existsSync(outputFile)) {
    const contents = fs.readFileSync(outputFile);
    const registryJSON = JSON.parse(contents.toString());
    registry = RepoIdRegistry.fromJSON(registryJSON);
  } else {
    registry = RepoIdRegistry.emptyRegistry();
  }
  registry = RepoIdRegistry.addRepoId(repoId, registry);

  fs.writeFileSync(outputFile, stringify(RepoIdRegistry.toJSON(registry)));
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

export default load;
