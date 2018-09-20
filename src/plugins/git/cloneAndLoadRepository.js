// @flow

import tmp from "tmp";
import {localGit} from "./gitUtils";
import type {Repository} from "./types";
import {loadRepository} from "./loadRepository";
import type {Repo} from "../../core/repo";

/**
 * Load Git repository data from a fresh clone of a GitHub repo. Loads
 * commits only.
 *
 * @param {Repo} repo
 *   the GitHub repository to be cloned
 * @return {Repository}
 *   the parsed Repository from the cloned repo
 */
export default function cloneAndLoadRepository(repo: Repo): Repository {
  const cloneUrl = `https://github.com/${repo.owner}/${repo.name}.git`;
  const tmpdir = tmp.dirSync({unsafeCleanup: true});
  const git = localGit(tmpdir.name);
  git(["clone", cloneUrl, ".", "--quiet"]);
  const result = loadRepository(tmpdir.name, "HEAD");
  tmpdir.removeCallback();
  return result;
}
