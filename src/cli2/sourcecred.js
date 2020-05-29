// @flow

import type {Command} from "./command";

<<<<<<< HEAD
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
=======
const sourcecred: Command = async (args, std) => {
  std.err("SourceCred CLI v2 not yet implemented");
  return 1;
>>>>>>> 0f6a76556958d00ea65a54fbd2aa666f0812162b
};

export default sourcecred;
