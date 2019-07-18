// @flow

// This file is a complement to `./project_io.js`. It contains the
// implementation of `getProjectIds`, which is written in plain ECMAScript so
// that we can depend on it at build time. Regular users should not depend on
// this file; instead, depend on `./project_io.js`, which re-exports this
// method.
//
// This file is tested in ./project_io.test.js

const path = require("path");
const base64 = require("base-64");
const fs = require("fs-extra");

module.exports = function getProjectIds(
  sourcecredDirectory /*: string */
) /*: $ReadOnlyArray<string> */ {
  const projectsPath = path.join(sourcecredDirectory, "projects");
  let entries = [];
  try {
    entries = fs.readdirSync(projectsPath);
  } catch {
    return [];
  }
  const projectIds = [];
  for (const entry of entries) {
    const jsonPath = path.join(projectsPath, entry, "project.json");
    try {
      fs.statSync(jsonPath);
      projectIds.push(base64.decode(entry));
    } catch {
      continue;
    }
  }
  return projectIds;
};
