// @flow

import * as G from "../grain";
import * as P from "../../../util/combo";

/**
 * The NonnegativeGrain type ensures Grain amount is >= 0,
 * which is particularly useful in the case of policy budgets
 * or grain transfers.
 */
export opaque type NonnegativeGrain: G.Grain = G.Grain;

export function fromGrain(g: G.Grain): NonnegativeGrain {
  if (G.lt(g, G.ZERO)) {
    throw new Error(`Grain must be in nonnegative, got ${g}`);
  }
  return g;
}

export function fromInteger(n: number): NonnegativeGrain {
  return fromGrain(G.fromInteger(n));
}

export function fromString(s: string): NonnegativeGrain {
  return fromGrain(G.fromString(s));
}

export const grainParser: P.Parser<NonnegativeGrain> = P.fmap(
  G.parser,
  fromGrain
);
export const numberParser: P.Parser<NonnegativeGrain> = P.fmap(
  P.number,
  fromInteger
);
export const stringParser: P.Parser<NonnegativeGrain> = P.fmap(
  P.string,
  fromString
);
