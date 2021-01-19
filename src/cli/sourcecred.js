// @flow

import type {Command} from "./command";
import {VERSION_SHORT} from "../core/version";

import load from "./load";
import graph from "./graph";
import score from "./score";
import site from "./site";
import go from "./go";
import serve from "./serve";
import grain from "./grain";
import credrank from "./credrank";
import help from "./help";
import grain2 from "./grain2";

const sourcecred: Command = async (args, std) => {
  if (args.length === 0) {
    help([], {out: std.err, err: std.err});
    return 1;
  }
  switch (args[0]) {
    case "--version":
      std.out("sourcecred " + VERSION_SHORT);
      return 0;
    case "--help":
    case "help":
      return help(args.slice(1), std);
    case "load":
      return load(args.slice(1), std);
    case "graph":
      return graph(args.slice(1), std);
    case "score":
      return score(args.slice(1), std);
    case "site":
      return site(args.slice(1), std);
    case "go":
      return go(args.slice(1), std);
    case "serve":
      return serve(args.slice(1), std);
    case "grain":
      return grain(args.slice(1), std);
    case "grain2":
      return grain2(args.slice(1), std);
    case "credrank":
      return credrank(args.slice(1), std);
    default:
      std.err("fatal: unknown command: " + JSON.stringify(args[0]));
      std.err("fatal: run 'sourcecred help' for commands and usage");
      return 1;
  }
};

export default sourcecred;
