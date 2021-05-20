// @flow

import {DataStorage} from "../core/storage";
import {decode} from "../core/storage/textEncoding";
import * as P from "./combo";

const notFound = (e): boolean => e.code === "ENOENT" || e.number === 404;

/**
 * Load and parse a JSON file from DataStorage.
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
  return parser.parseOrThrow(JSON.parse(decode(contents)));
}

/**
 * Load and parse a JSON file from DataStorage, with a default to use if the
 * file is not found.
 *
 * This is intended as a convenience for situations where the user may
 * optionally provide configuration in a json file.
 *
 * The default must be provided as a function that returns a default, to
 * accommodate situations where the object may be mutable, or where constructing
 * the default may be expensive.
 *
 * If no file is present at that location, then the default constructor is
 * invoked to create a default value, and that is returned.
 *
 * If attempting to load the file fails for any reason other than ENOENT or a
 * 404 (e.g. the path actually is a directory), then the error is thrown.
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
    return parser.parseOrThrow(JSON.parse(decode(contents)));
  } catch (e) {
    if (notFound(e)) {
      console.log(`File not found at path: ${path}. Defaulting.`);
      return def();
    } else {
      throw e;
    }
  }
}

/**
 * Read a text file from DataStorage, with a default string value to use if the
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
 * If attempting to load the file fails for any reason other than ENOENT or a
 * 404 (e.g. the path actually is a directory), then the error is thrown.
 */
export async function loadFileWithDefault(
  storage: DataStorage,
  path: string,
  def: () => string
): Promise<string> {
  try {
    return decode(await storage.get(path));
  } catch (e) {
    if (notFound(e)) {
      return def();
    } else {
      throw e;
    }
  }
}
