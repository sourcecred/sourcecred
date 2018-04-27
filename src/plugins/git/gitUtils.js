// @flow

import fs from "fs";
import mkdirp from "mkdirp";
import path from "path";

import type {GitDriver} from "./loadRepository";

interface Utils {
  head(): string;
  writeAndStage(filename: string, contents: string): void;
  deterministicCommit(message: string): void;
}

export function makeUtils(git: GitDriver, repositoryPath: string): Utils {
  return {
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
