// @flow

import {Command, flags} from "@oclif/command";
import stringify from "json-stable-stringify";

import type {Graph} from "../../core/graph";
import createGitGraph from "../../plugins/git/cloneGitGraph";
import createGithubGraph from "../../plugins/github/fetchGithubGraph";

export default class PluginGraphCommand extends Command {
  static description = "create the contribution graph for a single plugin";

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
      description: "plugin whose graph to generate",
      required: true,
      options: ["git", "github"],
    }),
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
      args: {repo_owner: repoOwner, repo_name: repoName},
      flags: {"github-token": token, plugin},
    } = this.parse(PluginGraphCommand);
    pluginGraph(plugin, repoOwner, repoName, token);
  }
}

function pluginGraph(
  plugin: "git" | "github",
  repoOwner: string,
  repoName: string,
  githubToken?: string
) {
  switch (plugin) {
    case "git":
      display(Promise.resolve(createGitGraph(repoOwner, repoName)));
      break;
    case "github":
      if (githubToken == null) {
        // TODO: This check should be abstracted so that plugins can
        // specify their argument dependencies and get nicely
        // formatted errors.
        console.error("fatal: No GitHub token specified. Try `--help'.");
        process.exitCode = 1;
        return;
      } else {
        display(createGithubGraph(repoOwner, repoName, githubToken));
      }
      break;
    default:
      // eslint-disable-next-line no-unused-expressions
      (plugin: empty);
      console.error("fatal: Unknown plugin: " + plugin);
      process.exitCode = 1;
      return;
  }
}

function display<NP, EP>(promise: Promise<Graph<NP, EP>>) {
  promise.then((graph) => {
    console.log(stringify(graph, {space: 4}));
  });
}
