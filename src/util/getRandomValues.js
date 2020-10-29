// @flow

/**
 * getRandomValues is a random number generator. It utilizes both Node and
 * browser crypto libraries to securely generate a Uint8 array of specified
 * length that contains truly random entries.
 *
 * The function takes advantage of javascript's just-in-time compilation in
 * order to work with Observable notebooks (https://observablehq.com). By
 * deferring the node crypto module import until it's actually needed,
 * this code is never encountered in the environment Observable provides for
 * imports to run.
 */
export default function getRandomValues(buf: Uint8Array): Uint8Array {
  if (
    typeof window !== "undefined" &&
    window.crypto &&
    window.crypto.getRandomValues
  ) {
    return window.crypto.getRandomValues(buf);
  }
  if (
    typeof window !== "undefined" &&
    typeof window.msCrypto === "object" &&
    typeof window.msCrypto.getRandomValues === "function"
  ) {
    return window.msCrypto.getRandomValues(buf);
  }
  const nodeCrypto = require("crypto"); // want externals here
  if (nodeCrypto.randomBytes) {
    if (!(buf instanceof Uint8Array)) {
      throw new TypeError("expected Uint8Array");
    }
    if (buf.length > 65536) {
      const e = new Error();
      e.message =
        "Failed to execute 'getRandomValues' on 'Crypto': The " +
        "ArrayBufferView's byte length (" +
        buf.length +
        ") exceeds the " +
        "number of bytes of entropy available via this API (65536).";
      e.name = "QuotaExceededError";
      throw e;
    }
    const bytes = nodeCrypto.randomBytes(buf.length);
    buf.set(bytes);
    return buf;
  } else {
    throw new Error("No secure random number generator available.");
  }
}
