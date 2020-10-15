// @flow

import {type NodeAddressT, NodeAddress} from "../../core/graph";
import type {EthAddress} from "./ethAddressFile";
import {nodePrefix} from "./declaration";

//type KeyEntries = {|[address: EthAddress]: boolean|};

export function nodeAddressForEthAddress(address: EthAddress): NodeAddressT {
  return NodeAddress.append(nodePrefix, address);
}

//function createKeyEntries(): KeyEntries {}
