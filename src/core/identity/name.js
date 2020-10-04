// @flow

import * as C from "../../util/combo";

/**
 * A Name is an identity name which has the following properties:
 * - It consists of alphanumeric ASCII and of dashes, which makes it suitable
 *   for including in urls (so we can give each contributor a hardcoded URL
 *   showing their contributions, Cred, and Grain).
 * - It is unique within an instance. Also, no two identites may have names that both
 *   have the same lowercase representation.
 * - It's chosen by (and changeable by) the owner of the identity.
 */
export opaque type Name: string = string;
const NAME_PATTERN = /^[A-Za-z0-9-]+$/;

// Based on GitHub's requirements.
const MAXIMUM_NAME_LENGTH = 39;

/**
 * Parse a Name from a string.
 *
 * Throws an error if the Name is invalid.
 */
export function nameFromString(name: string): Name {
  if (!name.match(NAME_PATTERN)) {
    throw new Error(`invalid name: ${name}`);
  }
  if (name.length > MAXIMUM_NAME_LENGTH) {
    throw new Error(`name too long: ${name}`);
  }
  return name;
}

const COERCE_PATTERN = /[^A-Za-z0-9-]/g;
/**
 * Attempt to coerce a string into a valid name, by replacing invalid
 * characters like `_` or `#` with hyphens.
 *
 * This can still error, if given a very long string or the empty string, it
 * will fail rather than try to change the name length.
 */
export function coerce(name: string): Name {
  const coerced = name.replace(COERCE_PATTERN, "-");
  return nameFromString(coerced);
}

export const parser: C.Parser<Name> = C.fmap(C.string, nameFromString);
