// @flow

import * as C from "../../util/combo";
import {
  type Uuid,
  random as randomUuid,
  parser as uuidParser,
} from "../../util/uuid";
import {type Login, parser as loginParser, loginFromString} from "./login";
import {type Alias, parser as aliasParser} from "./alias";
import {type IdentityType, parser as identityTypeParser} from "./identityType";
import {
  type NodeAddressT,
  NodeAddress,
  type Node as GraphNode,
  type NodeContraction,
} from "../../core/graph";
import {IDENTITY_PREFIX} from "./declaration";

export type IdentityId = Uuid;

export type Identity = {|
  // UUID, assigned when the identity is created.
  +id: IdentityId,
  // TODO (@decentralion): Rename this to `login` in the upcoming identity refactor
  +name: Login,
  +subtype: IdentityType,
  // The identity's own node address.
  +address: NodeAddressT,
  // Every other node in the graph that this identity corresponds to.
  // Does not include the identity's "own" address, i.e. the result
  // of calling (identityAddress(identity.id)).
  +aliases: $ReadOnlyArray<Alias>,
|};

export function newIdentity(subtype: IdentityType, login: string): Identity {
  const id = randomUuid();
  try {
    identityTypeParser.parseOrThrow(subtype);
  } catch (e) {
    throw new Error(`invalid identity subtype: ${subtype}`);
  }
  return {
    id,
    subtype,
    address: NodeAddress.append(IDENTITY_PREFIX, subtype, id),
    name: loginFromString(login),
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
  name: loginParser,
  address: NodeAddress.parser,
  aliases: C.array(aliasParser),
});
