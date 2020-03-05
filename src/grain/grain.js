// @flow

/**
 * This module contains the types for tracking Grain, which is the native
 * project-specific, cred-linked token created in SourceCred instances. In
 * practice, projects can call these tokens anything they want, but we will
 * refer to the tokens as "Grain" throughout the codebase. The conserved
 * properties of all Grains are that they are minted/distributed based on cred
 * scores, and that they can be used to Boost contributions in a cred graph.
 *
 * Grain is represented by [BigInt]s so that we can avoid precision issues.
 * Following the convention for ERC20 tokens, we will track and format Grain
 * with 18 decimals of precision.
 *
 * Unfortunately Flow does not support BigInts yet. For now, we will hack
 * around this by lying to Flow and claiming that the BigInts are actually
 * numbers. Whenever we actually construct a BigInt, we will
 * suppress the flow error at that declaration. Mixing BigInts with other types
 * (e.g. 5n + 3) produces a runtime error, so even though Flow will not save
 * us from these, they will be easy to detect. See [facebook/flow#6639][flow]
 *
 * [BigInt]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt
 * [flow]: https://github.com/facebook/flow/issues/6639
 */
export type Grain = number;

// $ExpectFlowError
export const zero = 0n;

// One "full" grain (with 18 decimals precision)
// $ExpectFlowError
export const one = 10n ** 18n;

/**
 * Format a grain balance as a human-readable number, removing 18 digits of
 * precision. By default, it will present the largest whole value (i.e.
 * 3500000000000000000 will be formatted as 3). Optionally, the client may
 * specify additional digits of precision. At present it always rounds down,
 * although we might change this in the future.
 */
export function format(g: Grain, decimals: number = 0): string {
  if (
    Math.floor(decimals) !== decimals ||
    decimals < 0 ||
    !isFinite(decimals) ||
    decimals > 18
  ) {
    throw new Error(
      `decimals must be integer in range [0..18], got ${decimals}`
    );
  }

  // $ExpectFlowError
  let div = 10n ** 18n;
  let result = String(g / div);
  g %= div;
  if (decimals > 0) {
    result += ".";
    while (decimals > 0) {
      // $ExpectFlowError
      div /= 10n;
      result += String(g / div);
      g = g % div;
      decimals--;
    }
  }
  return result;
}
