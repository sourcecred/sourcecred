// @flow
// Implementation of the root `sourcecred` command.

import type {Command} from "./command";

import load from "./load";

const sourcecred: Command = async (args, std) => {
  return load(args, std);
};

export default sourcecred;
