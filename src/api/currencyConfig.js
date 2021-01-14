// @flow

import * as C from "../util/combo";
import * as NullUtil from "../util/null";

/**
 * Shape of concurrencyDetails.json on disk
 */
type SerializedCurrencyDetails = {|
  +currencyName?: string,
  +currencySuffix?: string,
|};

/**
 * Shape of currencyDetails json in memory after parsing
 */
export type CurrencyDetails = {|
  +name: string,
  +suffix: string,
|};

export const DEFAULT_NAME = "Grain";
export const DEFAULT_SUFFIX = "g";

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
  };
}

export const parser: C.Parser<CurrencyDetails> = C.fmap(
  C.object({}, {currencyName: C.string, currencySuffix: C.string}),
  upgrade
);
