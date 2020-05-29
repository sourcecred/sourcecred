// @flow

import type {Command} from "./command";

import load from "./load";

const sourcecred: Command = async (args, std) => {
  if (args.length === 0) {
    std.err("fatal: specify a command");
    return 1;
  }
  switch (args[0]) {
    case "load":
      return load(args.slice(1), std);
    default:
      std.err("fatal: unknown command: " + JSON.stringify(args[0]));
      return 1;
  }
};

export default sourcecred;
