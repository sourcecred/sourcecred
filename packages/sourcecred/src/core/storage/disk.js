// @flow

import type {WritableDataStorage} from "./index";
import {join as pathJoin} from "path";
import normalize from "../../util/pathNormalize";
import fs from "fs-extra";

/**
 * Disk Storage abstracts away low-level file I/O operations.
 */
export class DiskStorage implements WritableDataStorage {
  +_basePath: string;

  /**
   * basePath will resolve to '.' if an empty string is passed in
   */
  constructor(basePath: string) {
    this._basePath = normalize(basePath);
  }

  /**
   * The `path` parameter must be relative to the `basePath` set at
   * construction. Any I/O errors when attempting to read contents at the path
   * will cause an error to be thrown.
   */
  async get(path: string): Promise<Uint8Array> {
    const validPath = this._checkPathPrefix(path);
    return fs.readFile(validPath);
  }

  /**
   * The `path` parameter must be relative to the `basePath` set at
   * construction. Any I/O errors when attempting to write contents at the path
   * will cause an error to be thrown.
   */
  async set(path: string, contents: Uint8Array): Promise<void> {
    const validPath = this._checkPathPrefix(path);
    return fs.writeFile(validPath, contents);
  }

  /**
   * `path` is a relative file path to the `basePath`. The normalized
   * result cannot be above the instance's base path. This is ensures that any
   * attempts at accessing the file system outside of the instance
   * will cause an error to throw.
   */
  _checkPathPrefix(path: string): string {
    const fullPath = normalize(pathJoin(this._basePath, path));
    // Ensure normalized path isn't outside basePath
    if (!(fullPath.startsWith(this._basePath) || this._basePath === ".")) {
      throw new Error(
        "Path construction error; possible path traversal attack"
      );
    }
    return fullPath;
  }
}
