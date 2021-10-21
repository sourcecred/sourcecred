// @flow

import {DataStorage, WritableDataStorage} from "./index";
import normalize from "../../util/pathNormalize";
import {join as pathJoin, isAbsolute} from "path";
import fetch from "cross-fetch";

/**
 * This class serves as a simple wrapper for http GET requests using fetch.
 */
export class OriginStorage implements DataStorage {
  _base: string;
  constructor(base: string) {
    this._base = normalize(base);
  }

  /**
   * This get method will error if a non-200 or 300-level status was returned.
   */
  async get(resource: string): Promise<Uint8Array> {
    const path = normalize(pathJoin(this._base, resource));
    if (
      !path.startsWith(this._base) &&
      (path.startsWith("..") || isAbsolute(path) || this._base !== ".")
    )
      throw new Error(
        `Path traversal is not allowed. ${path} is not a subpath of ${this._base}`
      );
    const result = await fetch(path);
    if (!result.ok) {
      const error = new Error(
        `Error fetching ${resource}: ${result.status} ${result.statusText}`
      );
      error.number = result.status;
      throw error;
    }

    return new Uint8Array(await result.arrayBuffer());
  }
}

export class PostableOriginStorage
  extends OriginStorage
  implements WritableDataStorage {
  _headers: {[string]: string | number};

  constructor(base: string, headers: {[string]: string | number}) {
    super(base);
    this._headers = headers;
  }

  async set(path: string, body: Uint8Array): Promise<void> {
    let payload;
    if (typeof window !== "undefined") {
      payload = new Blob([body.buffer]);
    } else {
      payload = body.buffer;
    }

    await fetch(path, {
      headers: this._headers,
      method: "POST",
      body: payload,
    });
  }
}

export const createPostableLedgerStorage = (
  base: string
): PostableOriginStorage => {
  return new PostableOriginStorage(base, {
    Accept: "text/plain",
    "Content-Type": "text/plain",
  });
};
