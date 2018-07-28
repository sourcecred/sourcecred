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
  nodeMaxOldSpaceSizeFlag,
  sourcecredDirectoryFlag,
} from "../common";

import {makeRepo} from "../../core/repo";

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

  static args = [
    {
      name: "repo_owner",
      required: true,
      description: "owner of the GitHub repository for which to fetch data",
    },
    {
      name: "repo_name",
      required: true,
      description: "name of the GitHub repository for which to fetch data",
    },
  ];

  static flags = {
    plugin: flags.string({
      description: "plugin whose data to load (loads all plugins if not set)",
      required: false,
      options: pluginNames(),
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
      args: {repo_owner: owner, repo_name: name},
      flags: {
        "github-token": githubToken,
        "sourcecred-directory": basedir,
        "max-old-space-size": maxOldSpaceSize,
        plugin,
      },
    } = this.parse(PluginGraphCommand);
    const repo = makeRepo(owner, name);
    if (!plugin) {
      loadAllPlugins({
        basedir,
        plugin,
        repo,
        githubToken,
        maxOldSpaceSize,
      });
    } else {
      loadPlugin({basedir, plugin, repo, githubToken});
    }
  }
}

function loadAllPlugins({basedir, repo, githubToken, maxOldSpaceSize}) {
  if (githubToken == null) {
    // TODO: This check should be abstracted so that plugins can
    // specify their argument dependencies and get nicely
    // formatted errors.
    console.error("fatal: No GitHub token specified. Try `--help'.");
    process.exitCode = 1;
    return;
  }
  const tasks = [
    ...pluginNames().map((pluginName) => ({
      id: `load-${pluginName}`,
      cmd: [
        "node",
        `--max_old_space_size=${maxOldSpaceSize}`,
        "./bin/sourcecred.js",
        "load",
        repo.owner,
        repo.name,
        "--plugin",
        pluginName,
        "--github-token",
        githubToken,
      ],
      deps: [],
    })),
  ];
  execDependencyGraph(tasks, {taskPassLabel: "DONE"}).then(({success}) => {
    if (success) {
      addToRepoRegistry({basedir, repo});
    }
    process.exitCode = success ? 0 : 1;
  });
}

function loadPlugin({basedir, plugin, repo, githubToken}) {
  const outputDirectory = path.join(
    basedir,
    "data",
    repo.owner,
    repo.name,
    plugin
  );
  mkdirp.sync(outputDirectory);
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
          repo,
          outputDirectory,
        });
      }
      break;
    case "git":
      loadGitData({repo, outputDirectory});
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
