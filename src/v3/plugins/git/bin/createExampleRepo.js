// @flow

import fs from "fs";

import {
  createExampleRepo,
  createExampleSubmoduleRepo,
} from "../demoData/exampleRepo";

function parseArgs() {
  const argv = process.argv.slice(2);
  const fail = () => {
    const invocation = process.argv.slice(0, 2).join(" ");
    throw new Error(`Usage: ${invocation} [--[no-]submodule] TARGET_DIRECTORY`);
  };

  let submodule: boolean = false;
  let target: ?string = null;

  for (const arg of argv) {
    if (arg === "--submodule") {
      submodule = true;
    } else if (arg === "--no-submodule") {
      submodule = false;
    } else {
      if (target == null) {
        target = arg;
      } else {
        fail();
      }
    }
  }

  if (target == null) {
    fail();
    throw new Error("Unreachable"); // for Flow
  }
  return {
    submodule,
    target: (target: string),
  };
}

function ensureEmptyDirectoryOrNonexistent(target: string) {
  const files = (() => {
    try {
      return fs.readdirSync(target);
    } catch (e) {
      if (e.code === "ENOTDIR") {
        throw new Error("Target exists, but is not a directory.");
      } else if (e.code === "ENOENT") {
        // No problem. We'll create it.
        return [];
      } else {
        throw e;
      }
    }
  })();
  if (files.length > 0) {
    throw new Error("Target directory exists, but is nonempty.");
  }
}

function main() {
  const args = parseArgs();
  ensureEmptyDirectoryOrNonexistent(args.target);
  if (args.submodule) {
    createExampleSubmoduleRepo(args.target);
  } else {
    createExampleRepo(args.target);
  }
}

main();
