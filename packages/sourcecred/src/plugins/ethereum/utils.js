// @flow

import {createIdentity, createIdentities} from "./createIdentities";
import {parseAddress, truncateEthAddress} from "./ethAddress";
import {nodeAddressForEthAddress} from "./ethAddressNode";

export const address = {
  parseAddress,
  truncateEthAddress,
  nodeAddressForEthAddress,
};

export const identity = {
  createIdentities,
  createIdentity,
};
