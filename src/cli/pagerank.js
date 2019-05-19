// @flow
// Implementation of `sourcecred pagerank`.

import fs from "fs-extra";
import path from "path";

import {Graph} from "../core/graph";
import {
  PagerankGraph,
  DEFAULT_SYNTHETIC_LOOP_WEIGHT,
  DEFAULT_CONVERGENCE_THRESHOLD,
  DEFAULT_MAX_ITERATIONS,
} from "../core/pagerankGraph";
import {repoIdToString, stringToRepoId, type RepoId} from "../core/repoId";
import dedent from "../util/dedent";
import type {Command} from "./command";
import * as Common from "./common";
import stringify from "json-stable-stringify";
import {loadGraph, type LoadGraphResult} from "../analysis/loadGraph";

import {type Weights, defaultWeights} from "../analysis/weights";
import {type NodeAndEdgeTypes} from "../analysis/types";
import {combineTypes} from "../analysis/pluginDeclaration";
import {weightsToEdgeEvaluator} from "../analysis/weightsToEdgeEvaluator";
import {AnalysisAdapter as GithubAnalysisAdapter} from "../plugins/github/analysisAdapter";
import {AnalysisAdapter as GitAnalysisAdapter} from "../plugins/git/analysisAdapter";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred pagerank REPO_ID [--help]

    Runs PageRank for a given REPO_ID, and saves the resultant
    PagerankGraph to the SOURCECRED_DIRECTORY. Data must already
    be loaded for the given REPO_ID, using 'sourcecred load REPO_ID'.

    PageRank is always run with the default plugin weights. We expect
    to make the weights configurable in the future.

    REPO_ID refers to a GitHub repository in the form OWNER/NAME: for
    example, torvalds/linux. The REPO_ID may be a "combined" repo as
    created by the --output flag to sourcecred load.

    Running this command may take a lot of heap. If it fails with an
    out of memory (OOM) issue, try manually increasing the heap size
    by passing the following argument to node process:
    '--max_old_space_size=8192'
    as in:
    'node --max_old_space_size=8192 bin/sourcecred.js pagerank ...'

    Arguments:
        REPO_ID
            Already-loaded repository for which to load data.

        --help
            Show this help message and exit, as 'sourcecred help pagerank'.

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
  std.err("fatal: run 'sourcecred help pagerank' for help");
  return 1;
}

/**
 * Harness to create a Pagerank CLI command.
 * It's factored so as to make it easy to test the CLI bits, separately
 * from the core logic.
 * It takes a `loader`, which loads the graph corresponding to a RepoId,
 * a `pagerankRunner` which runs pagerank on that graph, and a `saver`
 * which is responsible for saving the resultant PagerankGraph to disk.
 */
export function makePagerankCommand(
  loadGraph: (RepoId) => Promise<LoadGraphResult>,
  runPagerank: (Graph) => Promise<PagerankGraph>,
  savePagerankGraph: (RepoId, PagerankGraph) => Promise<void>
): Command {
  return async function pagerank(args, std) {
    let repoId: RepoId | null = null;
    for (let i = 0; i < args.length; i++) {
      switch (args[i]) {
        case "--help": {
          usage(std.out);
          return 0;
        }
        default: {
          if (repoId != null) {
            return die(std, "multiple repository IDs provided");
          }
          // Should be a repository.
          repoId = stringToRepoId(args[i]);
          break;
        }
      }
    }

    if (repoId == null) {
      return die(std, "no repository ID provided");
    }

    const result: LoadGraphResult = await loadGraph(repoId);

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
        const pagerankGraph = await runPagerank(result.graph);
        await savePagerankGraph(repoId, pagerankGraph);
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

export async function runPagerank(
  weights: Weights,
  graph: Graph,
  types: NodeAndEdgeTypes
): Promise<PagerankGraph> {
  const evaluator = weightsToEdgeEvaluator(weights, types);
  const pagerankGraph = new PagerankGraph(
    graph,
    evaluator,
    DEFAULT_SYNTHETIC_LOOP_WEIGHT
  );
  await pagerankGraph.runPagerank({
    maxIterations: DEFAULT_MAX_ITERATIONS,
    convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
  });
  return pagerankGraph;
}

export async function savePagerankGraph(
  directory: string,
  repoId: RepoId,
  pg: PagerankGraph
): Promise<void> {
  const pgJSON = pg.toJSON();
  const pgDir = path.join(directory, "data", repoIdToString(repoId));
  await fs.ensureDir(pgDir);
  const pgFile = path.join(pgDir, "pagerankGraph.json");
  await fs.writeFile(pgFile, stringify(pgJSON));
}

export const defaultAdapters = () => [
  new GithubAnalysisAdapter(),
  new GitAnalysisAdapter(),
];

const declarations = () => defaultAdapters().map((x) => x.declaration());

const defaultLoader = (r: RepoId) =>
  loadGraph(Common.sourcecredDirectory(), defaultAdapters(), r);
export const defaultPagerank = (g: Graph) =>
  runPagerank(defaultWeights(), g, combineTypes(declarations()));
export const defaultSaver = (r: RepoId, pg: PagerankGraph) =>
  savePagerankGraph(Common.sourcecredDirectory(), r, pg);

export const pagerankCommand = makePagerankCommand(
  defaultLoader,
  defaultPagerank,
  defaultSaver
);

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export default pagerankCommand;
