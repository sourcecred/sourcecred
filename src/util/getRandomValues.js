// @flow

/*
 * API shim for `window.crypto.getRandomValues` in the browser, for
 * compatibility with browser, Node, Jest, and Observable.
 *
 * Forked from NPM `get-random-bytes` by Kenan Yildirim, which is
 * released under the MIT License.
 */

/**
 * Fill the given buffer with cryptographically secure random bytes. The
 * buffer length must not exceed 65536.
 */
export default function getRandomValues(buf: Uint8Array): Uint8Array {
  if (typeof window !== "undefined") {
    if (window.crypto && window.crypto.getRandomValues) {
      return window.crypto.getRandomValues(buf);
    }
    if (
      typeof window.msCrypto === "object" &&
      typeof window.msCrypto.getRandomValues === "function"
    ) {
      return window.msCrypto.getRandomValues(buf);
    }
  }

  if (typeof require !== "undefined") {
    // Late-import `crypto` to avoid `require` in Observable notebooks,
    // and avoid using a literal `require(...)` to prevent Webpack from
    // rewriting this. (Getting Webpack externals to work properly is
    // daunting.)
    //
    /* eslint-disable camelcase */
    /* eslint-disable no-undef */
    const realRequire =
      // $FlowExpectedError[cannot-resolve-name]
      typeof __non_webpack_require__ !== "undefined"
        ? __non_webpack_require__
        : require; /* needed for Jest */
    const nodeCrypto = realRequire("crypto");
    if (buf.length > 65536) {
      const e = new Error();
      (e: any).code = 22;
      e.message = `Quota exceeded: requested ${buf.length} > 65536 bytes`;
      e.name = "QuotaExceededError";
      throw e;
    }
    const bytes = nodeCrypto.randomBytes(buf.length);
    buf.set(bytes);
    return buf;
  }
  throw new Error("No secure random number generator available.");
}
