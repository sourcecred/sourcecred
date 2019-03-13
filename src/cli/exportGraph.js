// @flow
// Implementation of `sourcecred export-graph`.

import {repoIdToString, stringToRepoId, type RepoId} from "../core/repoId";
import dedent from "../util/dedent";
import type {Command} from "./command";
import * as Common from "./common";
import stringify from "json-stable-stringify";
import {loadGraph, type LoadGraphResult} from "../analysis/loadGraph";

import {AnalysisAdapter as GithubAnalysisAdapter} from "../plugins/github/analysisAdapter";
import {AnalysisAdapter as GitAnalysisAdapter} from "../plugins/git/analysisAdapter";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred export-graph REPO_ID [--help]

    Print a combined SourceCred graph for a given REPO_ID.
    Data must already be loaded for the given REPO_ID, using
    'sourcecred load REPO_ID'

    REPO_ID refers to a GitHub repository in the form OWNER/NAME: for
    example, torvalds/linux. The REPO_ID may be a "combined" repo as
    created by the --output flag to sourcecred load.

    Arguments:
        REPO_ID
            Already-loaded repository for which to load data.

        --help
            Show this help message and exit, as 'sourcecred help export-graph'.

    Environment Variables:
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
  std.err("fatal: run 'sourcecred help export-graph' for help");
  return 1;
}

export function makeExportGraph(
  loader: (RepoId) => Promise<LoadGraphResult>
): Command {
  return async function exportGraph(args, std) {
    let repoId: RepoId | null = null;
    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case "--help": {
          usage(std.out);
          return 0;
        }
        default: {
          if (repoId != null)
            return die(std, "multiple repository IDs provided");
          // Should be a repository.
          repoId = stringToRepoId(args[i]);
          break;
        }
      }
    }

    if (repoId == null) {
      return die(std, "no repository ID provided");
    }

    const result: LoadGraphResult = await loader(repoId);
    switch (result.status) {
      case "REPO_NOT_LOADED": {
        const repoIdStr = repoIdToString(repoId);
        std.err(`fatal: repository ID ${repoIdStr} not loaded`);
        std.err(`Try running \`sourcecred load ${repoIdStr}\` first.`);
        return 1;
      }
      case "PLUGIN_FAILURE": {
        std.err(
          `fatal: plugin "${result.pluginName}" errored: ${
            result.error.message
          }`
        );
        return 1;
      }
      case "SUCCESS": {
        const graphJSON = result.graph.toJSON();
        std.out(stringify(graphJSON));
        return 0;
      }
      // istanbul ignore next: unreachable per Flow
      default: {
        std.err(`Unexpected status: ${(result.status: empty)}`);
        return 1;
      }
    }
  };
}

const defaultAdapters = [new GithubAnalysisAdapter(), new GitAnalysisAdapter()];
const defaultLoadGraph = (r: RepoId) =>
  loadGraph(Common.sourcecredDirectory(), defaultAdapters, r);
export const exportGraph = makeExportGraph(defaultLoadGraph);

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export default exportGraph;
