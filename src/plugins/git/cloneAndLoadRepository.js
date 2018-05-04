// @flow

import tmp from "tmp";
import {localGit} from "./gitUtils";
import type {Repository} from "./types";
import {loadRepository} from "./loadRepository";

/**
 * Load Git Repository data from a fresh clone of a GitHub repo.
 *
 * @param {String} repoOwner
 *   the GitHub username of the owner of the repository to be cloned
 * @param {String} repoName
 *   the name of the repository to be cloned
 * @return {Repository}
 *   the parsed Repository from the cloned repo
 */
export default function cloneAndLoadRepository(
  repoOwner: string,
  repoName: string
): Repository {
  const cloneUrl = `https://github.com/${repoOwner}/${repoName}.git`;
  const tmpdir = tmp.dirSync({unsafeCleanup: true});
  const git = localGit(tmpdir.name);
  git(["clone", cloneUrl, ".", "--quiet"]);
  const result = loadRepository(tmpdir.name, "HEAD");
  tmpdir.removeCallback();
  return result;
}
