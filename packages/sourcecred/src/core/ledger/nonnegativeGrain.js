// @flow

import * as G from "./grain";
import * as P from "../../util/combo";

/**
 * The NonnegativeGrain type ensures Grain amount is >= 0,
 * which is particularly useful in the case of policy budgets
 * or grain transfers.
 */
export opaque type NonnegativeGrain: G.Grain = G.Grain;

export function fromGrain(g: G.Grain): NonnegativeGrain {
  if (G.lt(g, G.ZERO)) {
    throw new Error(`Grain amount must be nonnegative, got ${g}`);
  }
  return g;
}

export function fromInteger(n: number): NonnegativeGrain {
  return fromGrain(G.fromInteger(n));
}

export function fromString(s: string): NonnegativeGrain {
  return fromGrain(G.fromString(s));
}

export function fromFloatString(s: string): NonnegativeGrain {
  return fromGrain(G.fromFloatString(s));
}

export const grainParser: P.Parser<NonnegativeGrain> = P.fmap(
  G.parser,
  fromGrain
);
export const numberParser: P.Parser<NonnegativeGrain> = P.fmap(
  P.number,
  fromInteger
);
export const numberOrFloatStringParser: P.Parser<NonnegativeGrain> = P.orElse([
  P.fmap(P.integer, fromInteger),
  P.fmap(P.string, fromFloatString),
]);
export const stringParser: P.Parser<NonnegativeGrain> = P.fmap(
  P.string,
  fromString
);
