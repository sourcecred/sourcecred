// @flow

import * as C from "../../util/combo";

/**
 * A Login is an identity name which has the following properties:
 * - It consists of lowercase alphanumeric ASCII and of dashes, which
 *   makes it suitable for including in urls (so we can give each contributor
 *   a hardcoded URL showing their contributions, Cred, and Grain).
 * - It is unique within an instance.
 * - It's chosen by (and changeable by) the owner of the identity.
 */
export opaque type Login: string = string;
const LOGIN_PATTERN = /^[A-Za-z0-9-]+$/;

/**
 * Parse a Login from a string.
 *
 * Throws an error if the Login is invalid.
 */
export function loginFromString(login: string): Login {
  if (!login.match(LOGIN_PATTERN)) {
    throw new Error(`invalid login: ${login}`);
  }
  return login.toLowerCase();
}

export const parser: C.Parser<Login> = C.fmap(C.string, loginFromString);
