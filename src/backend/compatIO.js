// @flow

import fs from "fs-extra";
import stringify from "json-stable-stringify";
import {type Compatible} from "../util/compat";

/**
 * Utility functions, which allow us to read/write a Compatible of any
 * type to a JSON file. They should automatically detect the Flow types
 * and produce errors when misused.
 *
 * Note, the Compatible<T> type used cannot be opaque.
 */

/**
 * Creates a Compatible JSON file writer.
 * The writer's Flow type for `data` will automatically match the provided
 * `toJSON`'s argument type.
 * Optionally takes a `typeName` to improve error messages.
 */
export function compatWriter<T, J>(
  toJSON: (T) => Compatible<J>,
  typeName?: string
): (path: string, data: T) => Promise<void> {
  return async (path: string, data: T): Promise<void> => {
    try {
      await fs.writeFile(path, stringify(toJSON(data)));
    } catch (e) {
      throw new Error(
        `Could not write ${typeName ? typeName + " " : ""}data:\n${e}`
      );
    }
  };
}

/**
 * Creates a Compatible JSON file reader.
 * The reader's Flow type for the return value will automatically match the
 * provided `fromJSON`'s return type.
 * Optionally takes a `typeName` to improve error messages.
 */
export function compatReader<T>(
  fromJSON: (Compatible<any>) => T,
  typeName?: string
): (path: string) => Promise<T> {
  return async (path: string): Promise<T> => {
    if (!(await fs.exists(path))) {
      throw new Error(
        `Could not find ${typeName ? typeName + " " : ""}file at: ${path}`
      );
    }
    try {
      return fromJSON(JSON.parse(await fs.readFile(path)));
    } catch (e) {
      throw new Error(
        `Provided ${typeName ? typeName + " " : ""}file is invalid:\n${e}`
      );
    }
  };
}
