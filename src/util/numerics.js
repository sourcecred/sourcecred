// @flow

import * as C from "./combo";

/**
 * A library for making type-level assertions about numeric properties;
 * e.g. that a number is finite, or finite and non-negative, or an integer.
 *
 * We should avoid having these methods in numeric hot loops by doing "unsafe"
 * operations in the hot loop, and then validating on exiting the loop.
 *
 * Nonetheless, we avoid unnecessary function calls for performance reasons (i.e.
 * the validator functions avoid calling each other).
 */

// A number guaranteed to not be NaN, Infinity, or -Infinity
export opaque type Finite: number = number;
export function finite(n: number): Finite {
  if (!isFinite(n)) {
    throw new Error(`expected finite, got: ${n}`);
  }
  return n;
}
export const finiteParser: C.Parser<Finite> = C.fmap(C.number, finite);

export opaque type FiniteNonnegative: number = number;
export function finiteNonnegative(n: number): FiniteNonnegative {
  if (n < 0 || !isFinite(n)) {
    throw new Error(`expected finite nonnegative, got: ${n}`);
  }
  return n;
}
export const finiteNonnegativeParser: C.Parser<FiniteNonnegative> = C.fmap(
  C.number,
  finiteNonnegative
);

export opaque type Integer: number = number;
export function integer(n: number): Integer {
  if (!isFinite(n) || n !== Math.floor(n)) {
    throw new Error(`expected integer, got: ${n}`);
  }
  return n;
}
export const integerParser: C.Parser<Integer> = C.fmap(C.number, integer);

export opaque type NonnegativeInteger: number = number;
export function nonnegativeInteger(n: number): NonnegativeInteger {
  if (!isFinite(n) || n !== Math.floor(n) || n < 0) {
    throw new Error(`expected nonnegative integer, got: ${n}`);
  }
  return n;
}
export const nonnegativeIntegerParser: C.Parser<NonnegativeInteger> = C.fmap(
  C.number,
  nonnegativeInteger
);

// A number guaranteed to be in the range [0, 1]
export opaque type Proportion: number = number;
export function proportion(n: number): Proportion {
  if (!isFinite(n) || n < 0 || n > 1) {
    throw new Error(`expected proportion in [0, 1], got: ${n}`);
  }
  return n;
}
export const proportionParser: C.Parser<Proportion> = C.fmap(
  C.number,
  proportion
);
