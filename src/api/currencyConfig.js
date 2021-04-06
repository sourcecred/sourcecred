// @flow

import * as C from "../util/combo";
import * as NullUtil from "../util/null";

/**
 * Shape of currencyDetails.json on disk
 */
type SerializedCurrencyDetails = {|
  +currencyName?: string,
  +currencySuffix?: string,
  +decimalsToDisplay?: number,
|};

/**
 * Shape of currencyDetails json in memory after parsing
 */
export type CurrencyDetails = {|
  +name: string,
  +suffix: string,
  +decimals: number,
|};

export const DEFAULT_NAME = "Grain";
export const DEFAULT_SUFFIX = "g";
export const DEFAULT_DECIMALS = 2;

/**
 * Utilized by combo.fmap to enforce default currency values
 * when parsing. This engenders a "canonical default" since there
 * will be no need to add default fallbacks when handling currency
 * detail values after parsing the serialized file.
 */
function upgrade(c: SerializedCurrencyDetails): CurrencyDetails {
  return {
    name: NullUtil.orElse(c.currencyName, DEFAULT_NAME),
    suffix: NullUtil.orElse(c.currencySuffix, DEFAULT_SUFFIX),
    decimals: NullUtil.orElse(c.decimalsToDisplay, DEFAULT_DECIMALS),
  };
}

export function defaultCurrencyConfig(): CurrencyDetails {
  return {
    name: DEFAULT_NAME,
    suffix: DEFAULT_SUFFIX,
    decimals: DEFAULT_DECIMALS,
  };
}

export const parser: C.Parser<CurrencyDetails> = C.fmap(
  C.object(
    {},
    {
      currencyName: C.string,
      currencySuffix: C.string,
      decimalsToDisplay: C.number,
    }
  ),
  upgrade
);
