// @flow

import {execFileSync} from "child_process";
import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";

export interface Utils {
  exec: GitDriver;
  head(): string;
  writeAndStage(filename: string, contents: string): void;
  deterministicCommit(message: string): void;
}

export type GitDriver = (args: string[], options?: ExecOptions) => string;
// `ExecOptions` is the type of the second argument to `execFileSync`.
// See here for details: https://nodejs.org/api/child_process.html
type ExecOptions = Object;

export function localGit(repositoryPath: string): GitDriver {
  return function git(args: string[], options?: ExecOptions): string {
    return execFileSync(
      "git",
      ["-C", repositoryPath, ...args],
      options
    ).toString();
  };
}

export function makeUtils(repositoryPath: string): Utils {
  const git = localGit(repositoryPath);
  return {
    exec: git,

    head() {
      return git(["rev-parse", "HEAD"]).trim();
    },

    writeAndStage(filename: string, contents: string) {
      const filepath = path.join(repositoryPath, filename);
      const dirpath = path.join(repositoryPath, path.dirname(filename));
      mkdirp.sync(dirpath);
      fs.writeFileSync(filepath, contents);
      git(["add", filename]);
    },

    deterministicCommit(message: string): void {
      git(
        [
          "-c",
          "user.name=Test Runner",
          "-c",
          "user.email=nobody@example.com",
          "commit",
          "-m",
          message,
        ],
        {
          env: {
            TZ: "UTC",
            GIT_AUTHOR_DATE: "2001-02-03T04:05:06",
            GIT_COMMITTER_DATE: "2002-03-04T05:06:07",
          },
        }
      );
    },
  };
}
