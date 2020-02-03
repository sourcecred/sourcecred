// @flow

import {NodeAddress, type Node} from "../../core/graph";
import {nodePrefix} from "./declaration";
import {type Alias} from "./alias";

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
 * Create a new node representing an identity.
 */
export function identityNode(identity: Identity): Node {
  const re = new RegExp(USERNAME_PATTERN);
  const match = re.exec(identity.username);
  if (match == null) {
    throw new Error(`Invalid username: ${identity.username}`);
  }
  const username = match[1];
  const address = NodeAddress.append(nodePrefix, username);
  const description = `@${username}`;
  return {address, timestampMs: null, description};
}
