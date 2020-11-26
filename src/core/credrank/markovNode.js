// @flow

import * as C from "../../util/combo";
import {type NodeAddressT, NodeAddress} from "../graph";

export type MarkovNode = {|
  // Node address, unique within a Markov process graph. This is either
  // the address of a contribution node or an address under the
  // `sourcecred/core` namespace.
  +address: NodeAddressT,
  // Markdown source description, as in `Node` from `core/graph`.
  +description: string,
  // Amount of cred to mint at this node.
  +mint: number,
|};

export const parser: C.Parser<MarkovNode> = C.object({
  address: NodeAddress.parser,
  description: C.string,
  mint: C.number,
});
