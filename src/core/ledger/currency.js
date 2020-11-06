// @flow

import {
  ethAddressParser,
  type EthAddress,
} from "../../plugins/ethereum/ethAddress";
import * as C from "../../util/combo";

/**
 * EvmChainId is represented in the form of a stringified integer for all
 * EVM-based chains, including mainnet (1), and xDai (100).
 * The reason for this is that ethereum's client configuration utilizes
 * a number to represent chainId, and this way we can just transpose that
 * chainId here as a component of the currency Id, since the web3 client will
 * return a stringified integer when the chainId is requested.
 */
export opaque type EvmChainId: string = string;

export function parseEvmChainId(id: string): EvmChainId {
  const result = parseInt(id, 10).toString();
  if (Number.isNaN(result) || result !== id) {
    throw new Error(`Invalid EVM chainId value: ${id}`);
  }
  return id;
}

export type EvmId = {|
  +type: "EVM",
  +chainId: EvmChainId,
  /**
   * CurrencyAddress is a subset of all available EthAddresses.
   *
   * A currency address is the address of the token contract for an ERC20 token,
   * or the 20 byte-length equivalent of 0x0, which is the conventional address
   * used to represent ETH on the ethereum mainnet, or the native currency on an
   * EVM-based sidechain see here for more details on these semantics:
   * https://ethereum.org/en/developers/docs/intro-to-ethereum/#eth
   */
  +currencyAddress: EthAddress,
|};

/**
 * Example protocol symbols: "BTC" for bitcoin and "FIL" for Filecoin
 */
export opaque type ProtocolSymbol: string = string;

const protocolSymbolParser: C.Parser<ProtocolSymbol> = C.exactly([
  "BTC",
  "FIL",
]);

/**
 * Chains like Bitcoin and Filecoin do not have "production" sidechains so
 * we represent them as a string, as specified in the ProtocolSymbol type
 */
export type ProtocolId = {|
  +type: "PROTOCOL",
  +chainId: ProtocolSymbol,
|};

export type ChainId = EvmChainId | ProtocolSymbol;
export type CurrencyId = EvmId | ProtocolId;

export const evmChainParser: C.Parser<EvmChainId> = C.fmap(
  C.string,
  parseEvmChainId
);

export const evmIdParser: C.Parser<EvmId> = C.object({
  type: C.exactly(["EVM"]),
  chainId: evmChainParser,
  currencyAddress: ethAddressParser,
});

export const protocolIdParser: C.Parser<ProtocolId> = C.object({
  type: C.exactly(["PROTOCOL"]),
  chainId: protocolSymbolParser,
});

// @topocount TODO: enable protocolIdParser once we support its address types
export const currencyIdParser: C.Parser<CurrencyId> = C.orElse([
  evmIdParser,
  protocolIdParser,
]);
