// @flow

import {
  ethAddressParser,
  type EthAddress,
} from "../../plugins/ethereum/ethAddress";
import stringify from "json-stable-stringify";
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

export type Evm = {|
  +type: "EVM",
  +chainId: EvmChainId,
  /**
   * tokenAddress is a subset of all available EthAddresses.
   *
   * A token address is the address of the token contract for an ERC20 token,
   * or the 20 byte-length equivalent of 0x0, which is the conventional address
   * used to represent ETH on the ethereum mainnet, or the native currency on an
   * EVM-based sidechain. See here for more details on these semantics:
   * https://ethereum.org/en/developers/docs/intro-to-ethereum/#eth
   */
  +tokenAddress: EthAddress,
|};

/**
 * Example protocol symbols: "BTC" for bitcoin and "FIL" for Filecoin
 */
export opaque type ProtocolSymbol: string = string;

export const protocolSymbolParser: C.Parser<ProtocolSymbol> = C.exactly([
  "BTC",
  "FIL",
]);

/**
 * Chains like Bitcoin and Filecoin do not have "production" sidechains so
 * we represent them as a string, as specified in the ProtocolSymbol type
 */
export type Protocol = {|
  +type: "PROTOCOL",
  +chainId: ProtocolSymbol,
|};

export type ChainId = EvmChainId | ProtocolSymbol;
export type Currency = Evm | Protocol;

export const evmChainParser: C.Parser<EvmChainId> = C.fmap(
  C.string,
  parseEvmChainId
);

export const evmParser: C.Parser<Evm> = C.object({
  type: C.exactly(["EVM"]),
  chainId: evmChainParser,
  tokenAddress: ethAddressParser,
});

export const protocolParser: C.Parser<Protocol> = C.object({
  type: C.exactly(["PROTOCOL"]),
  chainId: protocolSymbolParser,
});

// @topocount TODO: enable protocolIdParser once we support its address types
export const currencyParser: C.Parser<Currency> = C.orElse([
  evmParser,
  protocolParser,
]);

/**
 * The Currency key must be stringified to ensure the data is retrievable.
 * Keying on the raw Currency object means keying on the object reference,
 * rather than the contents of the object.
 */
export opaque type CurrencyKey = string;

export function getCurrencyKey(currency: Currency): CurrencyKey {
  return stringify(currency);
}

export function buildCurrency(
  chainId: string,
  tokenAddress?: string
): Currency {
  return tokenAddress
    ? evmParser.parseOrThrow({
        type: "EVM",
        chainId,
        tokenAddress,
      })
    : protocolParser.parseOrThrow({
        type: "PROTOCOL",
        chainId,
      });
}
