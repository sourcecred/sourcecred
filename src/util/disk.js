// @flow

import fs from "fs-extra";
import {DataStorage} from "../core/storage";
import * as P from "./combo";

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
 * Load and parse a JSON file from disk.
 *
 * If the file cannot be read, then an error is thrown.
 * If parsing fails, an error is thrown.
 */
export async function loadJson<T>(
  storage: DataStorage,
  path: string,
  parser: P.Parser<T>
): Promise<T> {
  const contents = await storage.get(path);
  return parser.parseOrThrow(JSON.parse(contents.toString()));
}

/**
 * Load and parse a JSON file from disk, with a default to use if the file is
 * not found.
 *
 * This is intended as a convenience for situations where the user may
 * optionally provide configuration in a json file saved to disk.
 *
 * The default must be provided as a function that returns a default, to
 * accommodate situations where the object may be mutable, or where constructing
 * the default may be expensive.
 *
 * If no file is present at that location, then the default constructor is
 * invoked to create a default value, and that is returned.
 *
 * If attempting to load the file fails for any reason other than ENOENT
 * (e.g. the path actually is a directory), then the error is thrown.
 *
 * If parsing fails, an error is thrown.
 */
export async function loadJsonWithDefault<T>(
  storage: DataStorage,
  path: string,
  parser: P.Parser<T>,
  def: () => T
): Promise<T> {
  try {
    const contents = await storage.get(path);
    return parser.parseOrThrow(JSON.parse(contents.toString()));
  } catch (e) {
    if (e.code === "ENOENT") {
      return def();
    } else {
      throw e;
    }
  }
}

/**
 * Read a text file from disk, with a default string value to use if the
 * file is not found. The file is read in the default encoding, UTF-8.
 *
 * This is intended as a convenience for situations where the user may
 * optionally provide configuration in a non-JSON file saved to disk.
 *
 * The default must be provided as a function that returns a default, in
 * case constructing the default may be expensive.
 *
 * If no file is present at that location, then the default constructor is
 * invoked to create a default value, and that is returned.
 *
 * If attempting to load the file fails for any reason other than ENOENT
 * (e.g. the path actually is a directory), then the error is thrown.
 */
export async function loadFileWithDefault(
  storage: DataStorage,
  path: string,
  def: () => string
): Promise<string> {
  try {
    return (await storage.get(path)).toString();
  } catch (e) {
    if (e.code === "ENOENT") {
      return def();
    } else {
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
