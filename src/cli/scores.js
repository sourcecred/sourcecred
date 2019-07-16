// @flow
// Implementation of `sourcecred scores`.

import {toCompat, type Compatible} from "../util/compat";
import path from "path";
import fs from "fs-extra";
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
import {directoryForProjectId} from "../core/project_io";

const COMPAT_INFO = {type: "sourcecred/cli/scores", version: "0.1.0"};

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred scores PROJECT_ID [--help]

    Print the SourceCred user scores for a given PROJECT_ID.
    Data must already be loaded for the given PROJECT_ID, using
    'sourcecred load PROJECT_ID'

    PROJECT_ID refers to a project, as loaded by the \`load\` command.
    Run \`sourcecred load --help\` for details.

    Arguments:
        PROJECT_ID
            Already-loaded project for which to load data.

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
  let projectId: string | null = null;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      default: {
        if (projectId != null) return die(std, "multiple project IDs provided");
        projectId = args[i];
        break;
      }
    }
  }

  if (projectId == null) {
    return die(std, "no project ID provided");
  }

  const projectDirectory = directoryForProjectId(
    projectId,
    Common.sourcecredDirectory()
  );
  const credFile = path.join(projectDirectory, "cred.json");
  if (!fs.existsSync(credFile)) {
    std.err(`fatal: project ${projectId} not loaded`);
    std.err(`Try running \`sourcecred load ${projectId}\` first.`);
    return 1;
  }

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
