// @flow

import fs from "fs-extra";
import path from "path";

import cloneAndLoadRepository from "./cloneAndLoadRepository";
import {createGraph} from "./createGraph";
import type {Repo} from "../../core/repo";

export type Options = {|
  +repo: Repo,
  +outputDirectory: string,
  +cacheDirectory: string,
|};

export function loadGitData(options: Options): Promise<void> {
  const repository = cloneAndLoadRepository(options.repo);
  const graph = createGraph(repository);
  const blob = JSON.stringify(graph);
  const outputFilename = path.join(options.outputDirectory, "graph.json");
  return fs.writeFile(outputFilename, blob);
}
