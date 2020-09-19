// @flow

import type {Command} from "./command";

import load from "./load";
import graph from "./graph";
import score from "./score";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const NO_LOAD_ARG = "--no-load";

const goCommand: Command = async (args, std) => {
  let noLoad = false;
  if (args.length === 1 && args[0] === NO_LOAD_ARG) {
    noLoad = true;
  } else if (args.length !== 0) {
    return die(std, "usage: sourcecred go [--no-load]");
  }

  const commandSequence = [
    {name: "load", command: load},
    {name: "graph", command: graph},
    {name: "score", command: score},
  ];

  for (const {name, command} of commandSequence) {
    if (name === "load" && noLoad) continue;
    const ret = await command([], std);
    if (ret !== 0) {
      return die(std, `go: failed on command ${name}`);
    }
  }
  return 0;
};

export default goCommand;
