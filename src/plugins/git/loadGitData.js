// @flow

import fs from "fs-extra";
import path from "path";

import {Graph} from "../../core/graph";
import cloneAndLoadRepository from "./cloneAndLoadRepository";
import {createMinimalGraph} from "./createMinimalGraph";
import type {Repo} from "../../core/repo";

export type Options = {|
  +repos: $ReadOnlyArray<Repo>,
  +outputDirectory: string,
  +cacheDirectory: string,
|};

export function loadGitData(options: Options): Promise<void> {
  const graphs = options.repos.map((repo) => {
    const repository = cloneAndLoadRepository(repo);
    return createMinimalGraph(repository);
  });
  const graph = Graph.merge(graphs);
  const blob = JSON.stringify(graph);
  const outputFilename = path.join(options.outputDirectory, "graph.json");
  return fs.writeFile(outputFilename, blob);
}
