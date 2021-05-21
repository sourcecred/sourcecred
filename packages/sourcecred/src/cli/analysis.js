// @flow

import dedent from "../util/dedent";
import type {Command} from "./command";
import {Instance} from "../api/instance/instance";
import {LocalInstance} from "../api/instance/localInstance";
import {analysis} from "../api/main/analysis";

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
