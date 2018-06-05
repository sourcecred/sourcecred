// @flow

import {Command, flags} from "@oclif/command";
import mkdirp from "mkdirp";
import path from "path";

import {
  pluginNames,
  sourcecredDirectoryFlag,
  nodeMaxOldSpaceSizeFlag,
} from "../common";

const execDependencyGraph = require("../../../tools/execDependencyGraph")
  .default;

export default class GraphCommand extends Command {
  static description = `\
create the contribution graph for a repository

Create the contribution graph for a repository. This creates a
contribution graph for each individual plugin, and then combines the
individual graphs into one larger graph. The graphs are stored as JSON
files under SOURCECRED_DIRECTORY/graphs/REPO_OWNER/REPO_NAME.
`.trim();

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
    "sourcecred-directory": sourcecredDirectoryFlag(),
    "max-old-space-size": nodeMaxOldSpaceSizeFlag(),
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
      flags: {
        "github-token": token,
        "sourcecred-directory": sourcecredDirectory,
        "max-old-space-size": maxOldSpaceSize,
      },
    } = this.parse(GraphCommand);
    graph(sourcecredDirectory, repoOwner, repoName, token, maxOldSpaceSize);
  }
}

function graph(
  sourcecredDirectory: string,
  repoOwner: string,
  repoName: string,
  token: string,
  maxOldSpaceSize: number
) {
  const graphDirectory = path.join(
    sourcecredDirectory,
    "graphs",
    repoOwner,
    repoName
  );
  console.log("Storing graphs into: " + graphDirectory);
  mkdirp.sync(graphDirectory);
  const tasks = makeTasks(graphDirectory, {
    repoOwner,
    repoName,
    token,
    maxOldSpaceSize,
  });
  execDependencyGraph(tasks, {taskPassLabel: "DONE"}).then(({success}) => {
    process.exitCode = success ? 0 : 1;
  });
}

function makeTasks(
  graphDirectory,
  {repoOwner, repoName, token, maxOldSpaceSize}
) {
  const taskId = (id) => `create-${id}`;
  const graphFilename = (id) => path.join(graphDirectory, `graph-${id}.json`);
  const into = "./src/v1/cli/into.sh";
  return [
    ...pluginNames().map((id) => ({
      id: taskId(id),
      cmd: [
        into,
        graphFilename(id),
        "node",
        `--max_old_space_size=${maxOldSpaceSize}`,
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
        path.join(graphDirectory, "graph.json"),
        "node",
        `--max_old_space_size=${maxOldSpaceSize}`,
        "./bin/sourcecred.js",
        "combine",
        ...pluginNames().map((id) => graphFilename(id)),
      ],
      deps: pluginNames().map((id) => taskId(id)),
    },
  ];
}
