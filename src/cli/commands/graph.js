// @flow

import {Command, flags} from "@oclif/command";
import mkdirp from "mkdirp";
import path from "path";

import {defaultStorageDirectory, pluginNames} from "../common";

const execDependencyGraph = require("../../tools/execDependencyGraph").default;

// Makes the script crash on unhandled rejections instead of silently
// ignoring them. In the future, promise rejections that are not handled will
// terminate the Node.js process with a non-zero exit code.
process.on("unhandledRejection", (err) => {
  throw err;
});

export default class GraphCommand extends Command {
  static description = `\
create the contribution graph for a repository

Create the contribution graph for a repository. This creates a
contribution graph for each individual plugin, and then combines the
individual graphs into one larger graph. The graphs are stored as JSON
files under OUTPUT_DIR/REPO_OWNER/REPO_NAME, where OUTPUT_DIR is
configurable.
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
    "output-directory": flags.string({
      short: "o",
      description: "directory into which to store graphs",
      env: "SOURCECRED_OUTPUT_DIRECTORY",
      default: defaultStorageDirectory(),
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
      flags: {"github-token": token, "output-directory": outputDirectory},
    } = this.parse(GraphCommand);
    graph(outputDirectory, repoOwner, repoName, token);
  }
}

function graph(
  outputDirectory: string,
  repoOwner: string,
  repoName: string,
  token: string
) {
  const scopedDirectory = path.join(outputDirectory, repoOwner, repoName);
  console.log("Storing graphs into: " + scopedDirectory);
  mkdirp.sync(scopedDirectory);
  const tasks = makeTasks(scopedDirectory, {repoOwner, repoName, token});
  execDependencyGraph(tasks, {taskPassLabel: "DONE"}).then(({success}) => {
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
