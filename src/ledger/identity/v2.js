// @flow

import {parser as uuidParser, random as randomUuid} from "../../util/uuid";
import * as C from "../../util/combo";
import {type Alias, parser as aliasParser} from "./alias";
import {type IdentityId} from "./id";
import {
  type IdentityDescription,
  parser as descriptionParser,
} from "./description";
import {
  NodeAddress,
  type NodeAddressT,
  type Node as GraphNode,
  type NodeContraction,
} from "../../core/graph";
import {IDENTITY_PREFIX} from "./declaration";

export type Identity = {|
  +id: IdentityId,
  +aliases: $ReadOnlyArray<Alias>,
  +description: IdentityDescription,
|};
export const parser: C.Parser<Identity> = C.object({
  id: uuidParser,
  aliases: C.array(aliasParser),
  description: descriptionParser,
});

export function newIdentity(
  description: IdentityDescription,
  initialAliases: $ReadOnlyArray<Alias>
) {
  return parser.parseOrThrow({
    id: randomUuid(),
    aliases: initialAliases,
    description,
  });
}

export function identityAddress(identity: Identity): NodeAddressT {
  return NodeAddress.append(IDENTITY_PREFIX, identity.id);
}

export function graphNode(identity: Identity): GraphNode {
  return {
    address: identityAddress(identity),
    description: identity.description.displayName,
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
