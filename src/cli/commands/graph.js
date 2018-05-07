// @flow

import {Command, flags} from "@oclif/command";
import mkdirp from "mkdirp";
import os from "os";
import path from "path";

import {pluginNames} from "./common";

const execDependencyGraph = require("../../tools/execDependencyGraph").default;

export default class GraphCommand extends Command {
  static description = "create the contribution graph for a repository";

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
    "output-directory": flags.string({
      short: "o",
      description: "directory into which to store graphs",
    }),
    "github-token": flags.string({
      description:
        "a GitHub API token, as generated at " +
        "https://github.com/settings/tokens/new",
      required: true,
      env: "SOURCECRED_GITHUB_TOKEN",
    }),
  };

  async run() {
    const {
      args: {repo_owner: repoOwner, repo_name: repoName},
      flags: {"github-token": token, "output-directory": rawOutputDirectory},
    } = this.parse(GraphCommand);
    const outputDirectory = (() => {
      if (rawOutputDirectory != null) {
        return rawOutputDirectory;
      }
      const outputDirectory = path.join(os.tmpdir(), "sourcecred", repoName);
      this.log("Using output directory: " + outputDirectory);
      return outputDirectory;
    })();
    graph(outputDirectory, repoOwner, repoName, token);
  }
}

function graph(
  outputDirectory: string,
  repoOwner: string,
  repoName: string,
  token: string
) {
  mkdirp.sync(outputDirectory);
  const tasks = makeTasks(outputDirectory, {repoOwner, repoName, token});
  execDependencyGraph(tasks).then(({success}) => {
    process.exitCode = success ? 0 : 1;
  });
}

function makeTasks(outputDirectory, {repoOwner, repoName, token}) {
  const taskId = (id) => `create-${id}`;
  const graphFilename = (id) => path.join(outputDirectory, `graph-${id}.json`);
  const into = "./src/cli/into.sh";
  return [
    ...pluginNames().map((id) => ({
      id: taskId(id),
      cmd: [
        into,
        graphFilename(id),
        "node",
        "./bin/sourcecred.js",
        "plugin-graph",
        "--plugin",
        id,
        repoOwner,
        repoName,
        "--github-token",
        token,
      ],
      deps: [],
    })),
    {
      id: "combine",
      cmd: [
        into,
        path.join(outputDirectory, "graph.json"),
        "node",
        "./bin/sourcecred.js",
        "combine",
        ...pluginNames().map((id) => graphFilename(id)),
      ],
      deps: pluginNames().map((id) => taskId(id)),
    },
  ];
}
