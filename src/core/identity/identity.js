// @flow

import * as C from "../../util/combo";
import {
  type Uuid,
  random as randomUuid,
  parser as uuidParser,
} from "../../util/uuid";
import {type Name, parser as nameParser, nameFromString} from "./name";
import {type Alias, parser as aliasParser} from "./alias";
import {type IdentityType, parser as identityTypeParser} from "./identityType";
import {
  type NodeAddressT,
  NodeAddress,
  type Node as GraphNode,
  type NodeContraction,
} from "../../core/graph";

export type IdentityId = Uuid;

export type Identity = {|
  // UUID, assigned when the identity is created.
  +id: IdentityId,
  +name: Name,
  +subtype: IdentityType,
  // The identity's own node address.
  // The address is guaranteed to start with IDENTITY_PREFIX, and to
  // include the identity id for uniqueness. Beyond that, you may NOT make any
  // assumptions about the particular address structure. Remember that these
  // addresses are permanent.
  +address: NodeAddressT,
  // Every other node in the graph that this identity corresponds to.
  // Does not include the identity's "own" address, i.e. the result
  // of calling (identityAddress(identity.id)).
  +aliases: $ReadOnlyArray<Alias>,
|};

// It's not in the typical [owner, name] format because it isn't provided by a plugin.
// Instead, it's a raw type owned by SourceCred project.
export const IDENTITY_PREFIX: NodeAddressT = NodeAddress.fromParts([
  "sourcecred",
  "core",
  "IDENTITY",
]);

export function newIdentity(subtype: IdentityType, name: string): Identity {
  const id = randomUuid();
  try {
    identityTypeParser.parseOrThrow(subtype);
  } catch (e) {
    throw new Error(`invalid identity subtype: ${subtype}`);
  }
  return {
    id,
    subtype,
    address: NodeAddress.append(IDENTITY_PREFIX, id),
    name: nameFromString(name),
    aliases: [],
  };
}

export function graphNode({name, address}: Identity): GraphNode {
  return {
    address,
    description: name,
    timestampMs: null,
  };
}

export function contractions(
  identities: $ReadOnlyArray<Identity>
): $ReadOnlyArray<NodeContraction> {
  return identities.map((i) => ({
    replacement: graphNode(i),
    old: i.aliases.map((a) => a.address),
  }));
}

export const parser: C.Parser<Identity> = C.object({
  id: uuidParser,
  subtype: identityTypeParser,
  name: nameParser,
  address: NodeAddress.parser,
  aliases: C.array(aliasParser),
});
