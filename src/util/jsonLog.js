// @flow

import stringify from "json-stable-stringify";
import * as C from "./combo";

/**
 * JsonLog tracks and serializes append-only logs of JSON objects.
 *
 * At its heart, it's basically a simple wrapper around an array, which
 * enforces the rule that items may be appended to it, but never removed.
 *
 * It also provides serialization logic. We store the log as a JSON object
 * with custom formatting, so that each entry appears on its own line in the
 * output JSON file.
 *
 * This way the log can be stored efficiently in Git repositories, thanks to
 * Git packfiles.
 *
 * The JsonLog is always parsed using a Combo.Parser, which ensures type safety
 * at runtime.
 */
export class JsonLog<T: C.JsonObject> {
  +_items: T[];

  constructor() {
    this._items = [];
  }

  append(item: T): JsonLog<T> {
    this._items.push(item);
    return this;
  }

  extend(items: Iterable<T>): JsonLog<T> {
    for (const item of items) {
      this._items.push(item);
    }
    return this;
  }

  values(): Iterator<T> {
    return this._items.values();
  }

  toString(): string {
    const stringifiedItems = this._items.map((x) => stringify(x) + "\n");
    return stringifiedItems.join("");
  }

  static fromString(log: string, parser: C.Parser<T>): JsonLog<T> {
    const result = new JsonLog();
    _extractLogLines(log).forEach((line, i) => {
      let parsed;
      try {
        parsed = parser.parse(JSON.parse(line));
      } catch (e) {
        throw new Error(`line ${i + 1} is not valid JSON: ${e}`);
      }
      if (parsed.ok) {
        result.append(parsed.value);
      } else {
        throw new Error(`line ${i + 1}: ${parsed.err}`);
      }
    });
    return result;
  }
}

function _extractLogLines(log: string): string[] {
  // In the legacy format, all automatically written ledgers erroneously
  // lacked trailing LF, but some hand-edited ones have them. In the new
  // format, all automatically written ledgers include a trailing LF.
  // Strip it, if present, for ease of `split("\n")`.
  log = log.trimRight();
  if (log.startsWith("[")) {
    // Temporarily compatibility measure for raw JSON arrays (not NDJSON),
    // in the specific form written by previous versions of this module.
    if (log === "[]") {
      return [];
    }
    const dataLines = log.split("\n").slice(1, -1);
    return dataLines.map((line) =>
      line.endsWith(",") ? line.slice(0, -1) : line
    );
  }
  return log.split("\n");
}
