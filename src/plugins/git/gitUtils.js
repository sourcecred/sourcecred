// @flow

import {execFileSync} from "child_process";
import fs from "fs-extra";
import path from "path";

export interface Utils {
  exec: GitDriver;
  head(): string;
  writeAndStage(filename: string, contents: string): void;
  deterministicCommit(message: string): void;
}

export type GitDriver = (args: string[], env?: {[string]: string}) => string;

export function localGit(repositoryPath: string): GitDriver {
  return function git(args: string[], env?: {[string]: string}): string {
    // We standardize the environment variables shown to Git, using
    // Git's test suite [1] as inspiration. It is particularly important
    // that `GIT_DIR` be unset from the parent process environment.
    // Otherwise, these tests have the wrong behavior when running in an
    // `exec` step of a Git rebase.
    //
    // [1]: https://github.com/git/git/blob/1f1cddd558b54bb0ce19c8ace353fd07b758510d/t/test-lib.sh#L90
    const baseEnv: {[string]: string | void} = {
      // Standardize output.
      LANG: "C",
      LC_ALL: "C",
      PAGER: "cat",
      TZ: "UTC",
      // Short-circuit editing.
      EDITOR: "true", // (this is `true` the command-line program)
      GIT_MERGE_AUTOEDIT: "no",
      // Ignore global Git settings, for test isolation.
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_ATTR_NOSYSTEM: "1",
      // Bring over the SSH configuration so that loading private repos is possible
      // This post has some useful information on SSH_AUTH_SOCK:
      // http://blog.joncairns.com/2013/12/understanding-ssh-agent-and-ssh-add/
      SSH_AUTH_SOCK: process.env.SSH_AUTH_SOCK,
    };
    const fullEnv: {[string]: string | void} = {
      ...baseEnv,
      ...(env || {}: {+[string]: string | void}),
    };
    const options = {env: fullEnv};
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
      fs.mkdirpSync(dirpath);
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
          GIT_AUTHOR_DATE: "2001-02-03T04:05:06",
          GIT_COMMITTER_DATE: "2002-03-04T05:06:07",
        }
      );
    },
  };
}
