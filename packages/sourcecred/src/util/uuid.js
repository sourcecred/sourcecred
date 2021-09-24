// @flow

// Universally unique identifiers. As in the UUID4 spec, we use
// uniformly random 128-bit payloads, but we represent them more
// compactly as base64 strings (22 characters long) rather than hex
// strings (36 characters with a bunch of hyphens). We also ensure that
// the serialized form is clean for machine and human eyes.

import {encode as base64Encode, decode as base64Decode} from "base-64";
import getRandomValues from "./getRandomValues";

import * as C from "./combo";

export opaque type Uuid: string = string;

// Any UUIDs that we generate will be purely alphanumeric and will not
// contain consecutive pairs of certain letters. Non-alphanumeric base64
// characters are either +/ or -_, depending on encoding. The former set
// is not URL-safe, and the latter set is not safe for command line
// arguments (IDs starting with hyphens) or easy legibility (consecutive
// hyphens or underscores). Consecutive occurrences of /csfhuit/i are
// forbidden per a heuristic given by <https://hashids.org/#cursing> to
// avoid common English curse words.
const _RE_UNCLEAN = /[+/\-_]|[csfhuit]{2}/i;

function isClean(s: string): boolean {
  return !s.match(_RE_UNCLEAN);
}

// Generate an unpadded base64 string of a uniformly random 128-bit
// payload. This may be unclean.
function randomUuidUnchecked(): string {
  const bytes = getRandomValues(new Uint8Array(16));
  const blob = [...bytes].map((n) => String.fromCharCode(n)).join("");
  return base64Encode(blob).slice(0, -2); // drop "==" padding
}

// Generate this many uniformly random UUIDs looking for a clean one.
// The total failure probability drops off exponentially with each try.
//
// To model the probability that `randomUuidUnchecked` emits a clean ID,
// consider a DFA with three states INIT, DANGER, and FAIL. If we ever
// see a non-alphanumeric character, go straight to FAIL (which
// absorbs). If we see one of the characters that must not appear twice
// consecutively, more from INIT to DANGER or DANGER to FAIL. If we see
// any other character, move from DANGER back to INIT. Then this is a
// Markov chain with transitions:
//
//   - INIT: 48/64 to INIT, 14/64 to DANGER, 2/64 to FAIL;
//   - DANGER: 48/64 to INIT, 16/64 to FAIL;
//   - FAIL: always back to FAIL.
//
// A 128-bit payload is base-64 encoded by 21 uniform code units plus
// one final code unit with less entropy (only 2 bits), but for
// simplicity we'll just model this as 22 uniform code units, which is
// very nearly correct. Then the probability of emitting an unclean ID
// is the probability that after 22 steps in this Markov chain starting
// from INIT we end up at FAIL---
//
//     $ octave --no-gui
//     >> A = [48 14 2; 48 0 16; 0 0 64] / 64;
//     >> A^22
//     ans =
//
//        0.15839   0.03738   0.80424
//        0.12815   0.03024   0.84161
//        0.00000   0.00000   1.00000
//
// ---which is about 80.4%. So any individual attempt is likely to fail,
// but after five attempts the probability of total failure is only
// 33.6%, and it drops off exponentially from there.
const _MAX_ATTEMPTS = 1024;

/**
 * Generate a uniformly random clean ID.
 */
export function random(): Uuid {
  for (let i = 0; i < _MAX_ATTEMPTS; i++) {
    const result: string = randomUuidUnchecked();
    if (isClean(result)) {
      // Because we use rejection sampling, this is uniformly random
      // among clean IDs.
      return (result: Uuid);
    }
  }
  // This is vanishingly unlikely (p ~= 10^-97). Something is wrong.
  // istanbul ignore next
  throw new Error(
    `failed to generate clean UUID after ${_MAX_ATTEMPTS} attempts`
  );
}

/**
 * Parse a serialized UUID. This is the left inverse of the trivial
 * injection from `Uuid` to `string`, and throws on invalid input.
 */
export function fromString(s: string): Uuid {
  if (s.endsWith("=")) {
    throw new Error("expected unpadded string: " + JSON.stringify(s));
  }
  if (s.length !== 22) {
    throw new Error("expected length-22 string: " + JSON.stringify(s));
  }
  if (!isClean(s)) {
    throw new Error(
      "unclean UUID: " + JSON.stringify(s) + JSON.stringify(_RE_UNCLEAN.exec(s))
    );
  }
  let bytes;
  try {
    bytes = base64Decode(s);
  } catch (e) {
    throw new Error("invalid base64 string: " + JSON.stringify(s));
  }
  if (base64Encode(bytes) !== s + "==") {
    // e.g., "z" === atob("eg") === atob("eh")
    throw new Error("non-canonical base64 string: " + JSON.stringify(s));
  }
  return s;
}

/**
 * Parse a serialized UUID. This expects to parse a JSON string value
 * with the same semantics as `fromString`.
 */
export const parser: C.Parser<Uuid> = C.fmap(C.string, fromString);

export const delimitedUuidParser: C.Parser<Uuid> = C.fmap(
  C.delimited("//"),
  (s) => fromString(s)
);
