// @flow

import {isAddress, toChecksumAddress} from "web3-utils";

import * as C from "../../util/combo";
import {compatibleParser} from "../../util/compat";

export opaque type EthAddress: string = string;

export const ETH_CURRENCY_ADDRESS: EthAddress =
  "0x0000000000000000000000000000000000000000";

/**
 * parseAddress will accept any 20-byte hexadecimal ethereum address encoded as
 * a string, optionally prefixed with `0x`.
 *
 * Per EIP-55 (https://eips.ethereum.org/EIPS/eip-55), parseAddress throws if
 * the provided string is mixed-case but not checksum-encoded. All valid
 * addresses in lower- and upper-case format will not throw.
 *
 * For consistency, all valid addresses are converted and returned in
 * mixed-case form with the `0x` prefix included
 *
 * valid formats:
 * "2Ccc7cD913677553766873483ed9eEDdB77A0Bb0"
 * "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0"
 * "0X2CCC7CD913677553766873483ED9EEDDB77A0BB0"
 * "0x2ccc7cd913677553766873483ed9eeddb77a0bb0"
 *
 * invalid formats:
 * "0x2ccc7cD913677553766873483ed9eEDdB77A0Bb0"
 * "2ccc7cD913677553766873483ed9eEDdB77A0Bb0"
 */
export function parseAddress(s: string): EthAddress {
  if (!isAddress(s)) {
    throw new Error(`not a valid ethereum address: ${s}`);
  }
  return toChecksumAddress(s);
}

// Utilized for a more readable and recognizable address. This is
// needed to allow the address to fit within the Identity name requirements
export function truncateEthAddress(address: EthAddress): string {
  const prefix = address.slice(0, 6);
  const suffix = address.slice(-4);
  return `${prefix}...${suffix}`;
}

export const ethAddressParser: C.Parser<EthAddress> = C.fmap(
  C.string,
  parseAddress
);

export const COMPAT_INFO = {
  type: "sourcecred/ethAddress",
  version: "0.0.1",
};

const addressEntriesParser = C.array(ethAddressParser);

export const parser: C.Parser<
  Array<EthAddress>
> = compatibleParser(COMPAT_INFO.type, {"0.0.1": addressEntriesParser});
