// @flow

import fs from "fs-extra";
import path from "path";

import cloneAndLoadRepository from "./cloneAndLoadRepository";
import {createGraph} from "./createGraph";

export type Options = {|
  +repoOwner: string,
  +repoName: string,
  +outputDirectory: string,
|};

export function loadGitData(options: Options): Promise<void> {
  const repository = cloneAndLoadRepository(
    options.repoOwner,
    options.repoName
  );
  const graph = createGraph(repository);
  const blob = JSON.stringify(graph);
  const outputFilename = path.join(options.outputDirectory, "graph.json");
  return fs.writeFile(outputFilename, blob);
}
