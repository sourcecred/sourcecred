// @flow

import dedent from "../util/dedent";
import type {Command} from "./command";
import findLastIndex from "lodash.findlastindex";
import * as C from "../util/combo";
import {DiskStorage} from "../core/storage/disk";
import {loadJsonWithDefault, loadFileWithDefault} from "../util/storage";
import {join as pathJoin} from "path";
import stringify from "json-stable-stringify";
import {encode} from "../core/storage/textEncoding";

/**
  The `update` CLI can be used by instance maintainers to magically update
  files in their instance after bumping the sourcecred version. This allows us
  to be more liberal in making breaking changes, as long as we provide updaters
  in this module to making the transition super easy for instance maintainers.

  To add an updater, create a new function for it below this string and then
  register your updater by appending it to the `updates` const defined below.
 */

const v0_9_0 = async () => {
  const storage = new DiskStorage(process.cwd());
  const oldDiscordParser = C.object(
    {
      guildId: C.string,
      reactionWeights: C.dict(C.number),
    },
    {
      roleWeightConfig: C.object({
        defaultWeight: C.number,
        weights: C.dict(C.number),
      }),
      channelWeightConfig: C.object({
        defaultWeight: C.number,
        weights: C.dict(C.number),
      }),
      propsChannels: C.array(C.string),
      includeNsfwChannels: C.boolean,
      defaultReactionWeight: C.number,
      applyAveragingToReactions: C.boolean,
    }
  );
  const discordConfigPath = pathJoin(
    "config",
    "plugins",
    "sourcecred",
    "discord",
    "config.json"
  );
  const discordConfig = await loadJsonWithDefault(
    storage,
    discordConfigPath,
    oldDiscordParser,
    () => null
  );
  if (discordConfig) {
    storage.set(
      discordConfigPath,
      encode(
        stringify(
          [
            {
              guildId: discordConfig.guildId,
              reactionWeightConfig: {
                weights: discordConfig.reactionWeights,
                applyAveraging:
                  discordConfig.applyAveragingToReactions || false,
                defaultWeight: discordConfig.defaultReactionWeight || 1,
              },
              roleWeightConfig: discordConfig.roleWeightConfig || {
                defaultWeight: 1,
                weights: {},
              },
              channelWeightConfig: discordConfig.channelWeightConfig || {
                defaultWeight: 1,
                weights: {},
              },
              propsChannels: discordConfig.propsChannels || [],
              includeNsfwChannels: discordConfig.includeNsfwChannels || false,
            },
          ],
          {space: 2}
        )
      )
    );
  }
};

/**
  Ascending order registry of updaters of type:
  [[majorVersion, minorVersion, pathVersion], updaterFunction]
 */
const updatesRegistry: $ReadOnlyArray<
  [[number, number, number], () => Promise<void>]
> = [[[0, 9, 0], v0_9_0]];

///
///
///
///
///

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const VERSION_REGEX = /^[0-9]*\.[0-9]*\.[0-9]*$/;
const UPDATER_FILE_FIRST_LINE =
  "Auto-generated. Commit changes, do not edit, do not delete.";
const UPGRADER_FILE_PATH = ["data", "upgrader.txt"];

const updateCommand: Command = async (args, std) => {
  const baseDir = process.cwd();
  const storage = new DiskStorage(baseDir);

  if (
    (args[0] && !args[0].match(VERSION_REGEX)) ||
    (args[1] && !args[1].match(VERSION_REGEX))
  ) {
    return die(
      std,
      "usage: sourcecred update [newVersion] [oldVersion]\nwhere the oldVersion and newVersion are of the form: X.X.X\nRecommended usage: sourcecred update"
    );
  }

  let oldVersion = args[1];
  if (!oldVersion) {
    const upgraderFile = await loadFileWithDefault(
      storage,
      pathJoin(...UPGRADER_FILE_PATH),
      () => ""
    );
    oldVersion = upgraderFile.split("\n")[1];
  }

  const selectedUpdates = selectUpdates(updatesRegistry, oldVersion, args[0]);

  for (const [v, f] of selectedUpdates) {
    await f();
    await storage.set(
      pathJoin(...UPGRADER_FILE_PATH),
      encode(UPDATER_FILE_FIRST_LINE + "\n" + v.join("."))
    );
    std.out(`Found and successfully ran upgrader for ${v.join(".")}`);
  }

  if (selectedUpdates.length)
    std.out(`\nRemember to commit and push changes to data/updater.txt`);
  else
    std.out(
      `No updaters found for ${oldVersion || "<first updater>"} to ${
        args[0] || "<last updater>"
      }`
    );

  return 0;
};

export const selectUpdates = (
  updatesRegistry: $ReadOnlyArray<
    [[number, number, number], () => Promise<void>]
  >,
  oldVersion: ?string,
  newVersion: ?string
): $ReadOnlyArray<[[number, number, number], () => Promise<void>]> => {
  const oldV = oldVersion
    ? oldVersion.split(".").map((x) => parseInt(x))
    : [-Infinity, -Infinity, -Infinity];
  const newV = newVersion
    ? newVersion.split(".").map((x) => parseInt(x))
    : [Infinity, Infinity, Infinity];
  if (
    oldV[0] > newV[0] ||
    (oldV[0] === newV[0] && oldV[1] > newV[1]) ||
    (oldV[0] === newV[0] && oldV[1] === newV[1] && oldV[2] >= newV[2])
  )
    throw "usage: sourcecred update [newVersion] [oldVersion] where the oldVersion and newVersion are of the form: X.X.X  Recommended usage: sourcecred update";
  const startingIndexInclusive =
    findLastIndex(
      updatesRegistry,
      ([v]) =>
        oldV[0] > v[0] ||
        (oldV[0] === v[0] && oldV[1] > v[1]) ||
        (oldV[0] === v[0] && oldV[1] === v[1] && oldV[2] >= v[2])
    ) + 1;
  let endingIndexExclusive = updatesRegistry.findIndex(
    ([v]) =>
      newV[0] < v[0] ||
      (newV[0] === v[0] && newV[1] < v[1]) ||
      (newV[0] === v[0] && newV[1] === v[1] && newV[2] < v[2])
  );
  if (endingIndexExclusive === -1)
    endingIndexExclusive = updatesRegistry.length;

  return updatesRegistry.slice(startingIndexInclusive, endingIndexExclusive);
};

export const updateHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      Recommended usage: sourcecred update

      usage: sourcecred update [newVersion] [oldVersion]
      where the newVersion and oldVersion are of the form: X.X.X

      If both args are omitted, it will try to load the last updater ran from
        data/updater.txt and either run all updaters after the last, or
        run all updaters if the file is not found.
      If oldVersion is omitted, it will try to load the last updater ran from
        data/updater.txt and either run all updaters after the last until the
        newVersion, or if the file is not found, run all updaters from the
        first until the newVersion.

      Generates data structures useful for data analysis and writes them to
      disk.
      `.trimRight()
  );
  return 0;
};

export default updateCommand;
