// @flow

import fs from "fs-extra";
import path from "path";
import stringify from "json-stable-stringify";

import type {RepoId} from "../../core/repoId";
import cloneAndLoadRepository from "./cloneAndLoadRepository";
import {mergeRepository} from "./mergeRepository";

export type Options = {|
  +repoIds: $ReadOnlyArray<RepoId>,
  +outputDirectory: string,
  +cacheDirectory: string,
|};

export function loadGitData(options: Options): Promise<void> {
  const repositories = options.repoIds.map((r) => cloneAndLoadRepository(r));
  const repository = mergeRepository(repositories);
  function writeToFile(filename, serializable) {
    const blob = stringify(serializable);
    const filePath = path.join(options.outputDirectory, filename);
    return fs.writeFile(filePath, blob);
  }
  return writeToFile("repository.json", repository)
}
