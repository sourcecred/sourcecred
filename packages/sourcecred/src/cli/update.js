// @flow

import dedent from "../util/dedent";
import type {Command} from "./command";
import {DiskStorage} from "../core/storage/disk";
import {loadFileWithDefault} from "../util/storage";
import {join as pathJoin} from "path";
import {encode} from "../core/storage/textEncoding";
import {v0_9_0} from "./update/v0_9_0";

/**
  The `update` CLI can be used by instance maintainers to magically update
  files in their instance after bumping the sourcecred version. This allows us
  to be more liberal in making breaking changes, as long as we provide updaters
  in this module to making the transition super easy for instance maintainers.

  To add an updater, create a new function for it in the cli/update folder and
  then register your updater by appending it to the `updatesRegistry` const 
  defined below.
 */

/**
  Ascending order registry of updaters of type:
  [updaterName, updaterFunction]
  New updaters should be added append-only.
 */
const updatesRegistry: $ReadOnlyArray<[string, () => Promise<void>]> = [
  ["0.9.0", v0_9_0],
];

///
///
///
///
///

const validNames = () => {
  return updatesRegistry.map(([name]) => name);
};

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const UPDATER_FILE_FIRST_LINE =
  "Auto-generated. Commit changes, do not edit, do not delete.";
const UPDATER_FILE_PATH = ["data", "updater.txt"];

const run = async (
  std,
  storage: DiskStorage,
  updaters: $ReadOnlyArray<[string, () => Promise<void>]>
) => {
  for (const [name, f] of updaters) {
    await f();
    await storage.set(
      pathJoin(...UPDATER_FILE_PATH),
      encode(UPDATER_FILE_FIRST_LINE + "\n" + name)
    );
    std.out(`Found and successfully ran updater for ${name}`);
  }
  std.out(`\nRemember to commit and push changes to data/updater.txt`);
};

const updateCommand: Command = async (args, std) => {
  const baseDir = process.cwd();
  const storage = new DiskStorage(baseDir);

  if (args.length < 0 || args.length > 1) {
    return die(
      std,
      "usage: sourcecred update [updaterName]\nRecommended usage: sourcecred update"
    );
  }
  if (args.length) {
    const updater = updatesRegistry.find(([name]) => args[0] === name);
    if (!updater)
      return die(
        std,
        `${
          args[0]
        } is not a valid updater name. Valid names: ${validNames().join(", ")}`
      );
    run(std, storage, [updater]);
    return 0;
  }

  const updaterFile = await loadFileWithDefault(
    storage,
    pathJoin(...UPDATER_FILE_PATH),
    () => ""
  );
  const startingName = updaterFile.split("\n")[1];

  const selectedUpdates = updatesRegistry.slice(
    updatesRegistry.findIndex(([name]) => name === startingName) + 1
  );
  if (selectedUpdates.length) {
    run(std, storage, selectedUpdates);
  } else
    std.out(
      startingName
        ? `No updaters found since ${startingName}.`
        : `No updaters found.`
    );
  return 0;
};

export const updateHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      Recommended usage: sourcecred update

      usage: sourcecred update [updaterName]
      valid names:
      ${validNames().join("\n")}

      If [updaterName] omitted, it will try to load the last updater ran from
        data/updater.txt and either run all updaters after the last, or
        run all updaters if the file is not found.

      Generates data structures useful for data analysis and writes them to
      disk.
      `.trimRight()
  );
  return 0;
};

export default updateCommand;
