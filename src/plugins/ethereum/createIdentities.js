// @flow

import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";
import {JsonLog} from "../../util/jsonLog";
import {type EthAddress} from "./ethAddress";
import {nodeAddressForEthAddress} from "./ethAddressNode";

export function _createIdentity(address: EthAddress): IdentityProposal {
  const alias = {
    description: address,
    address: nodeAddressForEthAddress(address),
  };

  return {
    pluginName: nameFromString("ethereum"),
    name: coerce(address),
    type: "USER",
    alias,
  };
}

export function createIdentities(
  ethAddresses: JsonLog<EthAddress>
): $ReadOnlyArray<IdentityProposal> {
  return Array.from(ethAddresses.values()).map(_createIdentity);
}
