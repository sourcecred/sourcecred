// @flow
// Implementation of `sourcecred scores`.

import {toCompat, type Compatible} from "../util/compat";
import path from "path";
import fs from "fs-extra";
import * as RepoIdRegistry from "../core/repoIdRegistry";
import {repoIdToString, stringToRepoId, type RepoId} from "../core/repoId";
import dedent from "../util/dedent";
import type {Command} from "./command";
import * as Common from "./common";
import stringify from "json-stable-stringify";
import {
  TimelineCred,
  type Interval,
  type CredNode,
} from "../analysis/timeline/timelineCred";
import {DEFAULT_CRED_CONFIG} from "../plugins/defaultCredConfig";
import {userNodeType} from "../plugins/github/declaration";
import * as GN from "../plugins/github/nodes";

const COMPAT_INFO = {type: "sourcecred/cli/scores", version: "0.1.0"};

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred scores REPO_ID [--help]

    Print the SourceCred user scores for a given REPO_ID.
    Data must already be loaded for the given REPO_ID, using
    'sourcecred load REPO_ID'

    REPO_ID refers to a GitHub repository in the form OWNER/NAME: for
    example, torvalds/linux. The REPO_ID may be a "combined" repo as
    created by the --output flag to sourcecred load.

    Arguments:
        REPO_ID
            Already-loaded repository for which to load data.

        --help
            Show this help message and exit, as 'sourcecred help scores'.

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
  std.err("fatal: run 'sourcecred help scores' for help");
  return 1;
}

export type NodeOutput = {|
  +id: string,
  +totalCred: number,
  +intervalCred: $ReadOnlyArray<number>,
|};

export type ScoreOutput = Compatible<{|
  +users: $ReadOnlyArray<NodeOutput>,
  +intervals: $ReadOnlyArray<Interval>,
|}>;

export const scores: Command = async (args, std) => {
  let repoId: RepoId | null = null;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      default: {
        if (repoId != null) return die(std, "multiple repository IDs provided");
        // Should be a repository.
        repoId = stringToRepoId(args[i]);
        break;
      }
    }
  }

  if (repoId == null) {
    return die(std, "no repository ID provided");
  }

  const directory = Common.sourcecredDirectory();
  const registry = RepoIdRegistry.getRegistry(directory);
  if (RepoIdRegistry.getEntry(registry, repoId) == null) {
    const repoIdStr = repoIdToString(repoId);
    std.err(`fatal: repository ID ${repoIdStr} not loaded`);
    std.err(`Try running \`sourcecred load ${repoIdStr}\` first.`);
    return 1;
  }

  const credFile = path.join(
    Common.sourcecredDirectory(),
    "data",
    repoIdToString(repoId),
    "cred.json"
  );
  const credBlob = await fs.readFile(credFile);
  const credJSON = JSON.parse(credBlob.toString());
  const timelineCred = TimelineCred.fromJSON(credJSON, DEFAULT_CRED_CONFIG);
  const userOutput: NodeOutput[] = timelineCred
    .credSortedNodes(userNodeType.prefix)
    .map((n: CredNode) => {
      const address = n.node.address;
      const structuredAddress = GN.fromRaw((address: any));
      if (structuredAddress.type !== GN.USERLIKE_TYPE) {
        throw new Error("invariant violation");
      }
      return {
        id: structuredAddress.login,
        intervalCred: n.cred,
        totalCred: n.total,
      };
    });
  const output: ScoreOutput = toCompat(COMPAT_INFO, {
    users: userOutput,
    intervals: timelineCred.intervals(),
  });
  std.out(stringify(output, {space: 2}));
  return 0;
};

export default scores;

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};
