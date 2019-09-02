// @flow
// implementation of `sourcecred clear`

import path from "path";
import rimraf from "rimraf";
const fs = require("fs-extra");

import dedent from "../util/dedent";
import {type Command} from "./command";
import * as Common from "./common";
import {directoryForProjectId} from "../core/project_io";
import {repoCacheFilename} from "../plugins/github/fetchGithubRepo";
import {type RepoId, stringToRepoId} from "../core/repoId";
import * as Schema from "../graphql/schema";

function usage(print: (string) => void): void {
  print(
    dedent`\
    usage: sourcecred clear --all
           sourcecred clear --cache
           sourcecred clear OWNER/NAME
           sourcecred clear --help

    Remove the SOURCECRED_DIRECTORY, i.e. the directory where data, caches,
    registries, etc. owned by SourceCred are stored. To remove individual
    projects, specify a GitHub repository in the form OWNER/NAME.

    Arguments:
        --all
            remove entire SOURCECRED_DIRECTORY

        --cache
            remove only the SourcCred cache directory

        OWNER/NAME:
          Identifier of a project to clear.

        --help
            Show this help message and exit, as 'sourcecred help clear'.

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
  std.err("fatal: run 'sourcecred help clear' for help");
  return 1;
}

export function makeClear(
  removeDir: (string) => Promise<void>,
  repoCacheFilename: (
    repoId: RepoId,
    token: string
  ) => Promise<{|+dbFilename: string, +resolvedId: Schema.ObjectId|}>,
  token: string
): Command {
  return async function clear(args, std) {
    const sourcecredDirectory = Common.sourcecredDirectory();
    const cacheDirectory = path.join(sourcecredDirectory, "cache");

    async function remove(dir) {
      try {
        await removeDir(dir);
        return 0;
      } catch (error) {
        return die(std, `${error}`);
      }
    }

    async function rmProject(repoArg, projectPath) {
      const repoId = stringToRepoId(repoArg);
      const {dbFilename} = await repoCacheFilename(repoId, token);
      try {
        await removeDir(path.join(cacheDirectory, dbFilename));
        await removeDir(projectPath);
      } catch (error) {
        return die(std, `${error}`);
      }
      return 0;
    }

    switch (args.length) {
      case 0:
        return die(std, "no arguments provided");
      case 1:
        switch (args[0]) {
          case "--help":
            usage(std.out);
            return 0;

          case "--all":
            return remove(sourcecredDirectory);

          case "--cache":
            return remove(cacheDirectory);

          default:
            const projectPath = directoryForProjectId(
              args[0],
              sourcecredDirectory
            );

            if (await fs.exists(projectPath)) {
              return rmProject(args[0], projectPath);
            } else {
              return die(std, `unrecognized argument: '${args[0]}'`);
            }
        }
      default:
        return die(
          std,
          `expected 1 argument but recieved: ${args.length} arguments`
        );
    }
  };
}

export function removeDir(p: string): Promise<void> {
  return new Promise((resolve, reject) =>
    rimraf(p, (error) => {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    })
  );
}

export const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export function validateGithubToken(): string {
  const token = Common.githubToken();
  if (token == null) {
    throw new Error("SOURCECRED_GITHUB_TOKEN not set");
  }
  const validToken = /^[A-Fa-f0-9]{40}$/;
  if (!validToken.test(token)) {
    throw new Error(`Invalid token: ${token}`);
  }
  return token;
}

export const clear = makeClear(
  removeDir,
  repoCacheFilename,
  validateGithubToken()
);

export default clear;
