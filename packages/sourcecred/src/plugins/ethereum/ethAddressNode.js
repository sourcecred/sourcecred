// @flow

import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {nodePrefix} from "./declaration";
import {type EthAddress} from "./ethAddress";

export function nodeAddressForEthAddress(address: EthAddress): NodeAddressT {
  return NodeAddress.append(nodePrefix, address);
}
