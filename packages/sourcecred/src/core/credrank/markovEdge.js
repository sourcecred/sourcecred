// @flow

import {makeAddressModule, type AddressModule} from "../address";
import {type NodeAddressT, type EdgeAddressT, EdgeAddress} from "../graph";
export type TransitionProbability = number;
export type MarkovEdge = {|
  // Address of the underlying edge. Note that this attribute alone does
  // not uniquely identify an edge in the Markov process graph; the
  // primary key is `(address, reversed)`, not just `address`. For edges
  // not in the underlying graph (e.g., fibration edges), this will be
  // an address under the `sourcecred/core` namespace.
  +address: EdgeAddressT,
  // If this came from an underlying graph edge or an epoch webbing
  // edge, have its `src` and `dst` been swapped in the process of
  // handling the reverse component of a bidirectional edge?
  +reversed: boolean,
  // Source node at the Markov chain level.
  +src: NodeAddressT,
  // Destination node at the Markov chain level.
  +dst: NodeAddressT,
  // Transition probability: $Pr[X_{n+1} = dst | X_{n} = src]$. Must sum
  // to 1.0 for a given `src`.
  +transitionProbability: TransitionProbability,
|};

export opaque type MarkovEdgeAddressT: string = string;
export const MarkovEdgeAddress: AddressModule<MarkovEdgeAddressT> = (makeAddressModule(
  {
    name: "MarkovEdgeAddress",
    nonce: "ME",
    otherNonces: new Map().set("N", "NodeAddress").set("E", "EdgeAddress"),
  }
): AddressModule<string>);

export function markovEdgeAddress(
  edgeAddress: EdgeAddressT,
  direction: "B" | /* Backward */ "F" /* Forward */
): MarkovEdgeAddressT {
  return MarkovEdgeAddress.fromParts([
    direction,
    ...EdgeAddress.toParts(edgeAddress),
  ]);
}

export function markovEdgeAddressFromMarkovEdge(
  edge: MarkovEdge
): MarkovEdgeAddressT {
  return markovEdgeAddress(
    edge.address,
    edge.reversed ? "B" /* Backward */ : "F" /* Forward */
  );
}
