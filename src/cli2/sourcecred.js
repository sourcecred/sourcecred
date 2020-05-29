// @flow

import type {Command} from "./command";

import load from "./load";
<<<<<<< HEAD
import graph from "./graph";
=======
>>>>>>> 80c3c382821dd0f6cd6c8ed032e2a01d711134d9

const sourcecred: Command = async (args, std) => {
  if (args.length === 0) {
    std.err("fatal: specify a command");
    return 1;
  }
  switch (args[0]) {
    case "load":
      return load(args.slice(1), std);
<<<<<<< HEAD
    case "graph":
      return graph(args.slice(1), std);
=======
>>>>>>> 80c3c382821dd0f6cd6c8ed032e2a01d711134d9
    default:
      std.err("fatal: unknown command: " + JSON.stringify(args[0]));
      return 1;
  }
};

export default sourcecred;
