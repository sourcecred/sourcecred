// @flow
// Implementation of `sourcecred help`.

import type {Command} from "./command";
import dedent from "../util/dedent";

const help: Command = async (args, std) => {
  if (args.length === 0) {
    usage(std.out);
    return 0;
  }
  const command = args[0];
  const subHelps: {[string]: Command} = {
    help: metaHelp,
  };
  if (subHelps[command] !== undefined) {
    return subHelps[command](args.slice(1), std);
  } else {
    usage(std.err);
    return 1;
  }
};

function usage(print: (string) => void): void {
  // TODO: Make the usage function pull its list of commands
  // from the sub-helps, to ensure that it is comprehensive
  print(
    dedent`\
    usage: sourcecred COMMAND [ARGS...]
           sourcecred [--version] [--help]

    Commands:
      help          show this help message

    Use 'sourcecred help COMMAND' for help about an individual command.
    `.trimRight()
  );
}

const metaHelp: Command = async (args, std) => {
  if (args.length === 0) {
    std.out(
      dedent`\
      usage: sourcecred help [COMMAND]

      Use 'sourcecred help' for general help and a list of commands.
      Use 'sourcecred help COMMAND' for help about COMMAND.
      `.trimRight()
    );
    return 0;
  } else {
    usage(std.err);
    return 1;
  }
};

export default help;
