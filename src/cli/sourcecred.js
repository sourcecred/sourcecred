// @flow
// Implementation of the root `sourcecred` command.

import type {Command} from "./command";

import {VERSION_SHORT} from "../core/version";

import help from "./help";
import load from "./load";
import scores from "./scores";
import clear from "./clear";
import genProject from "./genProject";

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
    case "clear":
      return clear(args.slice(1), std);
    case "scores":
      return scores(args.slice(1), std);
    case "gen-project":
      return genProject(args.slice(1), std);
    default:
      std.err("fatal: unknown command: " + JSON.stringify(args[0]));
      std.err("fatal: run 'sourcecred help' for commands and usage");
      return 1;
  }
};

export default sourcecred;
