// @flow

import dedent from "../util/dedent";
import type {Command} from "./command";
import {Instance} from "../api/instance/instance";
import {LocalInstance} from "../api/instance/localInstance";
import {analysis} from "../api/main/analysis";

/**
 * The grain command is soon to be deprecated, as part of a transition
 * to @blueridger's `CredGrainView`.  This original grain command uses
 * `CredView`, which will be deprecated.
 *
 * grain2 forks this command and eliminates the dependence on `CredView`
 */
const analysisCommand: Command = async () => {
  const baseDir = process.cwd();
  const instance: Instance = new LocalInstance(baseDir);
  const analysisInput = await instance.readAnalysisInput();

  const output = await analysis(analysisInput);

  instance.writeAnalysisOutput(output);

  return 0;
};

export const analysisHelp: Command = async (args, std) => {
  std.out(
    dedent`\
      usage: sourcecred analysis

      Generates data structures useful for data analysis and writes them to
      disk.
      `.trimRight()
  );
  return 0;
};

export default analysisCommand;
