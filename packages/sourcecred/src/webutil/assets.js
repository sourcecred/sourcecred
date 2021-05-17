// @flow

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
    this._root = root == null ? root : normalize(root);
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
  resolve(path: string): any {
    if (normalize(path.replace(/^\/+/, "")).startsWith("..")) {
      // It doesn't make sense to traverse past the site's root. This is
      // likely an error in the caller.
      throw new Error("path outside site root: " + path);
    }
    return normalize(`${this._getRoot()}/${path}`);
  }
}

/**
 * Given an absolute path `p`, return a relative path `r` such that a
 * web page at pathname `p` should use `r` to refer to the root of the
 * application. The result will only contain components `.` and `..`.
 *
 * Examples:
 *
 *   - "/foo/" maps to "..";
 *   - "/foo/bar" also maps to "..";
 *   - "/foo/bar/" maps to "../..";
 *   - "/" maps to ".".
 *
 * If the argument does not start with "/", an error will be thrown.
 */
export function rootFromPath(path: string): any {
  const normalized = normalize(path);
  if (normalized[0] !== "/") {
    throw new Error("expected absolute path: " + JSON.stringify(path));
  }
  const levels = (normalized.match(/\//g) || []).length;
  return normalize(new Array(levels - 1).fill("..").join("/"));
}
