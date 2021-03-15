// @flow

import fs from "fs-extra";

/**
 * Make a directory, if it doesn't already exist.
 */
export function mkdirx(path: string) {
  try {
    fs.mkdirSync(path);
  } catch (e) {
    if (e.code !== "EEXIST") {
      throw e;
    }
  }
}

/**
 * Check if a directory is empty
 *
 * Will error if a path that resolves to anything other
 * than a directory is provided
 */
export function isDirEmpty(dirPath: string): boolean {
  return fs.readdirSync(dirPath).length === 0;
}
