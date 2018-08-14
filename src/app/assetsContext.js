// @flow

import React from "react";

import normalize from "../util/pathNormalize";

/**
 * Resolver for static assets (e.g., images, PDFs) and API data (e.g.,
 * the repository registry, plugin data). Any references to resources
 * should be resolved through this API.
 */
export class Assets {
  +_root: ?string;

  /**
   * Construct a resolver given a path to the root of the site. This can
   * be a relative path, like `../..`, or an absolute path, like `/`.
   */
  constructor(root: ?string) {
    this._root = root;
  }

  _getRoot(): string {
    if (this._root == null) {
      throw new Error("asset root path uninitialized");
    }
    return this._root;
  }

  /**
   * Resolve a path as if the current directory and "/" both represent
   * the site root. For instance, "foo", "/foo", and "./foo" all
   * represent the same file. It is an error to specify a file that is
   * above the root, like "../bad".
   */
  resolve(path: string) {
    if (normalize(path.replace(/^\/+/, "")).startsWith("..")) {
      // It doesn't make sense to traverse past the site's root. This is
      // likely an error in the caller.
      throw new Error("path outside site root: " + path);
    }
    return normalize(`${this._getRoot()}/${path}`);
  }
}

export default React.createContext(new Assets(null));
