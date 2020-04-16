// @flow

import {NodeAddress, type Node} from "../../core/graph";
import {nodePrefix} from "./declaration";
import {type Alias} from "./alias";
import type {NodeAddressT} from "../../core/graph";

/**
 * A Username is a locally (within-instance) unique identifier for a user of
 * SourceCred. Must match the USERNAME_PATTERN regexp.
 */
export type Username = string;
export const USERNAME_PATTERN = "^@?([A-Za-z0-9-_]+)$";

/**
 * Configuration for combining user accounts into a single SourceCred identity.
 */
export type Identity = {|
  +username: Username,
  +aliases: $ReadOnlyArray<Alias>,
|};

/**
 * Fully specifies all Identity information.
 *
 * The discourseServerurl is needed if any Discourse aliases are present
 * in the included identities.
 */
export type IdentitySpec = {|
  +identities: $ReadOnlyArray<Identity>,
  +discourseServerUrl: string | null,
|};

/**
 * Internal method for validating a username.
 *
 * Returns the username with any leading @ symbol stripped.
 * Throws an error if the username is invalid.
 */
function validateUsername(username: string): Username {
  const re = new RegExp(USERNAME_PATTERN);
  const match = re.exec(username);
  if (match == null) {
    throw new Error(`Invalid username: ${username}`);
  }
  return match[1];
}

/**
 * Create a new node representing an identity.
 */
export function identityNode(identity: Identity): Node {
  const username = validateUsername(identity.username);
  const address = identityAddress(username);
  const description = `@${username}`;
  return {address, timestampMs: null, description};
}

export function identityAddress(username: Username): NodeAddressT {
  return NodeAddress.append(nodePrefix, validateUsername(username));
}
