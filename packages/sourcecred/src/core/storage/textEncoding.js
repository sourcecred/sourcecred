// @flow

import {
  // $FlowIssue[missing-export]
  TextEncoder as importedTextEncoder,
  TextDecoder as importedTextDecoder,
} from "util";

let encoder, decoder;
// ensure jest skips this condition
if (typeof window !== "undefined" && typeof process === "undefined") {
  if (!(window.TextEncoder && window.TextDecoder)) {
    throw new Error("No Encoder classes available.");
  }
  decoder = window.TextDecoder;
  encoder = window.TextEncoder;
} else {
  // load imported libraries or fallback to globals if imports are unavailable
  /* eslint-disable no-undef */
  // $FlowIssue[cannot-resolve-name]
  decoder = importedTextDecoder || globalThis.TextDecoder;
  /* eslint-disable no-undef */
  // $FlowIssue[cannot-resolve-name]
  encoder = importedTextEncoder || globalThis.TextEncoder;
}

// $FlowIssue[incompatible-call]
const decode: (a: Uint8Array) => string = (a) => new decoder().decode(a);
const encode: (s: string) => Uint8Array = (s) => new encoder().encode(s);

export {encode, decode};
