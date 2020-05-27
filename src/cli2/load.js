// @flow

import type {Command} from "./command";
import {loadInstanceConfig, pluginDirectoryContext} from "./common";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const loadCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    die(std, "usage: sourcecred load");
  }
  const baseDir = process.cwd();
  const config = await loadInstanceConfig(baseDir);
  for (const [name, plugin] of config.bundledPlugins) {
    const dirContext = pluginDirectoryContext(baseDir, name);
    plugin.load(dirContext);
  }
  return 0;
};

export default loadCommand;
