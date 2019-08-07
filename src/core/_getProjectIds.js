// @flow

// This file is a complement to `./project_io.js`. It contains the
// implementation of `getProjectIds`, which is written in plain ECMAScript so
// that we can depend on it at build time. Regular users should not depend on
// this file; instead, depend on `./project_io.js`, which re-exports this
// method.
//
// This file is tested in ./project_io.test.js

const path = require("path");
const base64url = require("base64url");
const fs = require("fs-extra");

/**
 * Get the ids for every project saved on the filesystem.
 *
 * It is not guaranteed that it will be possible to load the id in question.
 * (For example, the project may be malformed, or may have an outdated compat
 * version.)
 */
module.exports = async function getProjectIds(
  sourcecredDirectory /*: string */
) /*: Promise<$ReadOnlyArray<string>> */ {
  const projectsPath = path.join(sourcecredDirectory, "projects");
  let entries = [];
  try {
    entries = await fs.readdir(projectsPath);
  } catch {
    return [];
  }
  const getProjectId = async (entry) => {
    try {
      const jsonPath = path.join(projectsPath, entry, "project.json");
      await fs.stat(jsonPath);
      return base64url.decode(entry);
    } catch {
      return null;
    }
  };

  const maybeProjectIds = await Promise.all(entries.map(getProjectId));
  return maybeProjectIds.filter((x) => x != null);
};
