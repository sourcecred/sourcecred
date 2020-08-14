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

/**
 * Parse a Name from a string.
 *
 * Throws an error if the Name is invalid.
 */
export function nameFromString(name: string): Name {
  if (!name.match(NAME_PATTERN)) {
    throw new Error(`invalid name: ${name}`);
  }
  return name;
}

export const parser: C.Parser<Name> = C.fmap(C.string, nameFromString);
