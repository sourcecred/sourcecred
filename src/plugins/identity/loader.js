// @flow

import {Graph} from "../../core/graph";
import {type Identity} from "./identity";
import {nodeContractions} from "./nodeContractions";

export interface IdentityLoader {
  contractGraph(
    baseGraph: Graph,
    identities: $ReadOnlyArray<Identity>,
    discourseUrl: string | null
  ): Promise<Graph>;
}

export const identityLoader: IdentityLoader = {contractGraph};

async function contractGraph(
  baseGraph: Graph,
  identities: $ReadOnlyArray<Identity>,
  discourseUrl: string | null
): Promise<Graph> {
  const contractions = nodeContractions(identities, discourseUrl);
  // Only apply contractions if identities have been specified, since it involves
  // a full Graph copy
  return baseGraph.contractNodes(contractions);
}
