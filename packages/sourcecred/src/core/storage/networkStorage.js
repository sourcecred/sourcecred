// @flow

import {DataStorage} from "./index";
import fetch from "cross-fetch";

/**
 * This class serves as a simple wrapper for http GET requests using fetch.
 * If an empty string is passed as the base, the base will be interpretted
 * as '.'
 */
export class NetworkStorage implements DataStorage {
  _base: string;

  constructor(base: string) {
    this._base = base;
  }

  /**
   * This get method will error if a non-200 or 300-level status was returned,
   * or if the resource traverses above the base path.
   */
  async get(resource: string): Promise<Uint8Array> {
    const path = new URL(resource, this._base).href;
    if (!path.startsWith(this._base))
      throw new Error(
        `Path traversal is not allowed. ${path} does not begin with ${this._base} -- try adding trailing / to base`
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
