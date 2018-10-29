// @flow
// Implementation of `sourcecred analyze`

import {stringToRepoId, repoIdToString, type RepoId} from "../core/repoId";
import dedent from "../util/dedent";
import type {Command} from "./command";
import * as Common from "./common";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred analyze REPO_ID
           sourcecred analyze --help

    Analyze a loaded repository, generating a cred attribution for it.

    REPO_ID refers to a GitHub repository in the form OWNER/NAME: for
    example, torvalds/linux. The REPO_ID may be an 'aggregated
    repository' generated via the \`--output\` flag to \`sourcecred
    load\`

    Note: This command is not yet implemented.

    Arguments:
        REPO_ID
            Repository to analyze

        --help
            Show this help message and exit, as 'sourcecred help analyze'.

    Environment variables:
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
  std.err("fatal: run 'sourcecred help analyze' for help");
  return 1;
}

const analyze: Command = async (args, std) => {
  let repoId: RepoId | null = null;
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--help": {
        usage(std.out);
        return 0;
      }
      default: {
        // Should be a repository
        if (repoId != null) {
          return die(std, "multiple repositories provided");
        }
        repoId = stringToRepoId(args[i]);
        break;
      }
    }
  }
  if (repoId == null) {
    return die(std, "repository not specified");
  }

  std.out(`would analyze ${repoIdToString(repoId)}, but not yet implemented`);
  return 0;
};

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export default analyze;
