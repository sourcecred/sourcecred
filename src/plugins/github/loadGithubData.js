// @flow

import fs from "fs-extra";
import path from "path";

import fetchGithubRepo from "./fetchGithubRepo";
import {RelationalView} from "./relationalView";

export type Options = {|
  +token: string,
  +repoOwner: string,
  +repoName: string,
  +outputDirectory: string,
|};

export async function loadGithubData(options: Options): Promise<void> {
  const response = await fetchGithubRepo(
    options.repoOwner,
    options.repoName,
    options.token
  );
  const view = new RelationalView();
  view.addData(response);
  const blob = JSON.stringify(view);
  const outputFilename = path.join(options.outputDirectory, "view.json");
  return fs.writeFile(outputFilename, blob);
}
