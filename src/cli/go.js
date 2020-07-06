// @flow

import type {Command} from "./command";

import load from "./load";
import graph from "./graph";
import score from "./score";

function die(std, message) {
  std.err("fatal: " + message);
  return 1;
}

const goCommand: Command = async (args, std) => {
  if (args.length !== 0) {
    return die(std, "usage: sourcecred go");
  }
  const commandSequence = [
    {name: "load", command: load},
    {name: "graph", command: graph},
    {name: "score", command: score},
  ];
  for (const {name, command} of commandSequence) {
    const ret = await command([], std);
    if (ret !== 0) {
      return die(std, `go: failed on command ${name}`);
    }
  }
  return 0;
};

export default goCommand;
