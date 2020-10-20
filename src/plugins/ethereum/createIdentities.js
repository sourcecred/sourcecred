// @flow

import {type IdentityProposal} from "../../core/ledger/identityProposal";
import {coerce, nameFromString} from "../../core/identity/name";
import {
  truncateEthAddress as truncate,
  type EthAddress,
} from "./ethAddressFile";
import {nodeAddressForEthAddress} from "./ethAddressFile";

export function _createIdentity(address: EthAddress): IdentityProposal {
  const alias = {
    description: address,
    address: nodeAddressForEthAddress(address),
  };

  return {
    pluginName: nameFromString("ethereum"),
    name: coerce(truncate(address)),
    type: "USER",
    alias,
  };
}

export function createIdentities(
  ethAddresses: $ReadOnlyArray<EthAddress>
): $ReadOnlyArray<IdentityProposal> {
  return ethAddresses.map(_createIdentity);
}
