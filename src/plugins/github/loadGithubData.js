// @flow

import fs from "fs-extra";
import path from "path";

import fetchGithubRepo from "./fetchGithubRepo";
import {RelationalView} from "./relationalView";
import type {Repo} from "../../core/repo";

export type Options = {|
  +token: string,
  +repo: Repo,
  +outputDirectory: string,
|};

export async function loadGithubData(options: Options): Promise<void> {
  const response = await fetchGithubRepo(options.repo, options.token);
  const view = new RelationalView();
  view.addData(response);
  const blob = JSON.stringify(view);
  const outputFilename = path.join(options.outputDirectory, "view.json");
  return fs.writeFile(outputFilename, blob);
}
