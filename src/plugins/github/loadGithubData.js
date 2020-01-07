// @flow

import fs from "fs-extra";
import path from "path";
import pako from "pako";

import fetchGithubRepo from "./fetchGithubRepo";
import {RelationalView} from "./relationalView";
import type {RepoId} from "./repoId";

export type Options = {|
  +token: string,
  +repoIds: $ReadOnlyArray<RepoId>,
  +outputDirectory: string,
  +cacheDirectory: string,
|};

// This function is deprecated.
export async function loadGithubData(options: Options): Promise<void> {
  // We intentionally fetch repositories sequentially rather than in
  // parallel, because GitHub asks that we not make concurrent
  // requests. From <https://archive.is/LlkQp#88%>:
  //
  // > Make requests for a single user or client ID serially. Do not make
  // > make requests for a single user or client ID concurrently.
  const responses = [];
  for (const repoId of options.repoIds) {
    responses.push(
      await fetchGithubRepo(repoId, {
        token: options.token,
        cacheDirectory: options.cacheDirectory,
      })
    );
  }
  const view = new RelationalView();
  for (const response of responses) {
    view.addRepository(response);
  }
  view.compressByRemovingBody();
  const blob: Uint8Array = pako.gzip(JSON.stringify(view));
  const outputFilename = path.join(options.outputDirectory, "view.json.gz");
  return fs.writeFile(outputFilename, blob);
}
