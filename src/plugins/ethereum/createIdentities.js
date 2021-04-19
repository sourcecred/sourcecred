// @flow

import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";
import {type EthAddress} from "./ethAddress";
import {nodeAddressForEthAddress} from "./ethAddressNode";

export function createIdentity(address: EthAddress): IdentityProposal {
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
  ethAddresses: $ReadOnlyArray<EthAddress>
): $ReadOnlyArray<IdentityProposal> {
  return ethAddresses.map(createIdentity);
}
