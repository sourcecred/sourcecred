// @flow

import {type NodeAddressT, NodeAddress} from "../../core/graph";
import * as C from "../../util/combo";

/**
 * An Alias is basically another graph Node which resolves to this identity. We
 * ignore the timestamp because it's generally not significant for users; we
 * keep the address out of obvious necessity, and we keep the description so we
 * can describe this alias in UIs (e.g. the ledger admin panel).
 */
export type Alias = {|
  +description: string,
  +address: NodeAddressT,
|};

export const parser: C.Parser<Alias> = C.object({
  address: NodeAddress.parser,
  description: C.string,
});
