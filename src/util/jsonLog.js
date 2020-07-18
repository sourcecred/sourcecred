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

  append(items: Iterable<T>): JsonLog<T> {
    for (const item of items) {
      this._items.push(item);
    }
    return this;
  }

  values(): Iterator<T> {
    return this._items.values();
  }

  toString(): string {
    if (this._items.length === 0) {
      return "[]";
    }
    const stringifiedItems = this._items.map(stringify).join(",\n");
    return `[\n${stringifiedItems}\n]`;
  }

  static fromString(log: string, parser: C.Parser<T>): JsonLog<T> {
    const items = C.array(parser).parseOrThrow(JSON.parse(log));
    return new JsonLog().append(items);
  }
}
