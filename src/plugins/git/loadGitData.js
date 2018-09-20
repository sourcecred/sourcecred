// @flow

import fs from "fs-extra";
import path from "path";

import type {Repo} from "../../core/repo";
import cloneAndLoadRepository from "./cloneAndLoadRepository";
import {createMinimalGraph} from "./createMinimalGraph";
import {mergeRepository} from "./mergeRepository";

export type Options = {|
  +repos: $ReadOnlyArray<Repo>,
  +outputDirectory: string,
  +cacheDirectory: string,
|};

export function loadGitData(options: Options): Promise<void> {
  const repositories = options.repos.map((r) => cloneAndLoadRepository(r));
  const repository = mergeRepository(repositories);
  const graph = createMinimalGraph(repository);
  const blob = JSON.stringify(graph);
  const outputFilename = path.join(options.outputDirectory, "graph.json");
  return fs.writeFile(outputFilename, blob);
}
