// @flow

import {Command, flags} from "@oclif/command";
import mkdirp from "mkdirp";
import path from "path";
import fs from "fs";
import stringify from "json-stable-stringify";

import {loadGithubData} from "../../plugins/github/loadGithubData";
import {loadGitData} from "../../plugins/git/loadGitData";
import {
  pluginNames,
  defaultPlugins,
  nodeMaxOldSpaceSizeFlag,
  sourcecredDirectoryFlag,
} from "../common";

import {repoToString, stringToRepo} from "../../core/repo";

import {
  toJSON,
  fromJSON,
  addRepo,
  emptyRegistry,
  REPO_REGISTRY_FILE,
} from "../../app/credExplorer/repoRegistry";

const execDependencyGraph = require("../../tools/execDependencyGraph").default;

export default class PluginGraphCommand extends Command {
  static description = "load data required for SourceCred";

  static strict = false;

  static args = [
    {
      name: "repos",
      required: true,
      description:
        "GitHub repos to load (one per argument), represented as OWNER/NAME",
    },
  ];

  static flags = {
    plugin: flags.string({
      description:
        "plugin whose data to load (loads default plugins if not set)",
      required: false,
      options: pluginNames(),
    }),
    output: flags.string({
      description:
        "the GitHub repo under which to store output; " +
        "required unless exactly one repository is specified",
      required: false,
    }),
    "sourcecred-directory": sourcecredDirectoryFlag(),
    "max-old-space-size": nodeMaxOldSpaceSizeFlag(),
    "github-token": flags.string({
      description:
        "a GitHub API token, as generated at " +
        "https://github.com/settings/tokens/new" +
        "; required only if using the GitHub plugin",
      env: "SOURCECRED_GITHUB_TOKEN",
    }),
  };

  async run() {
    const {
      argv,
      flags: {
        output: defaultOutput,
        "github-token": githubToken,
        "sourcecred-directory": basedir,
        "max-old-space-size": maxOldSpaceSize,
        plugin,
      },
    } = this.parse(PluginGraphCommand);
    const repos = argv.map((s) => stringToRepo(s));
    const outputRepo = (() => {
      if (defaultOutput != null) {
        return stringToRepo(defaultOutput);
      } else if (repos.length === 1) {
        return repos[0];
      } else {
        throw new Error("output repository not specified");
      }
    })();
    if (!plugin) {
      loadDefaultPlugins({
        basedir,
        plugin,
        outputRepo,
        repos,
        githubToken,
        maxOldSpaceSize,
      });
    } else {
      loadPlugin({basedir, plugin, outputRepo, repos, githubToken});
    }
  }
}

function loadDefaultPlugins({
  basedir,
  outputRepo,
  repos,
  githubToken,
  maxOldSpaceSize,
}) {
  if (githubToken == null) {
    // TODO: This check should be abstracted so that plugins can
    // specify their argument dependencies and get nicely
    // formatted errors.
    console.error("fatal: No GitHub token specified. Try `--help'.");
    process.exitCode = 1;
    return;
  }
  const tasks = [
    ...defaultPlugins().map((pluginName) => ({
      id: `load-${pluginName}`,
      cmd: [
        "node",
        `--max_old_space_size=${maxOldSpaceSize}`,
        "./bin/sourcecred.js",
        "load",
        ...repos.map((repo) => repoToString(repo)),
        "--plugin",
        pluginName,
        "--github-token",
        githubToken,
        "--output",
        repoToString(outputRepo),
        "-d",
        basedir,
        "--max-old-space-size",
        maxOldSpaceSize,
      ],
      deps: [],
    })),
  ];
  execDependencyGraph(tasks, {taskPassLabel: "DONE"}).then(({success}) => {
    if (success) {
      addToRepoRegistry({basedir, repo: outputRepo});
    }
    process.exitCode = success ? 0 : 1;
  });
}

function loadPlugin({basedir, plugin, outputRepo, repos, githubToken}) {
  function scopedDirectory(key) {
    const directory = path.join(basedir, key, repoToString(outputRepo), plugin);
    mkdirp.sync(directory);
    return directory;
  }
  const outputDirectory = scopedDirectory("data");
  const cacheDirectory = scopedDirectory("cache");
  switch (plugin) {
    case "github":
      if (githubToken == null) {
        // TODO: This check should be abstracted so that plugins can
        // specify their argument dependencies and get nicely
        // formatted errors.
        console.error("fatal: No GitHub token specified. Try `--help'.");
        process.exitCode = 1;
        return;
      } else {
        loadGithubData({
          token: githubToken,
          repos,
          outputDirectory,
          cacheDirectory,
        });
      }
      break;
    case "git":
      loadGitData({repos, outputDirectory, cacheDirectory});
      break;
    default:
      console.error("fatal: Unknown plugin: " + (plugin: empty));
      process.exitCode = 1;
      return;
  }
}

function addToRepoRegistry(options) {
  // TODO: Make this function transactional before loading repositories in
  // parallel.
  const {basedir, repo} = options;
  const outputFile = path.join(basedir, REPO_REGISTRY_FILE);
  let registry = null;
  if (fs.existsSync(outputFile)) {
    const contents = fs.readFileSync(outputFile);
    const registryJSON = JSON.parse(contents.toString());
    registry = fromJSON(registryJSON);
  } else {
    registry = emptyRegistry();
  }
  registry = addRepo(repo, registry);

  fs.writeFileSync(outputFile, stringify(toJSON(registry)));
}
