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
export const ZERO = 0n;

// How many digits of precision there are in "one" grain
export const DECIMAL_PRECISION = 18;

// One "full" grain
// $ExpectFlowError
export const ONE = 10n ** BigInt(DECIMAL_PRECISION);

export const DEFAULT_SUFFIX = "g";

/**
 * Formats a grain balance as a human-readable number, dividing the
 * raw grain balance by `one`.
 *
 * The client controls how many digits of precision are shown; by default, we
 * display zero digits. Grain balances will have commas added as
 * thousands-separators if the balance is greater than 1000g.
 *
 * The client also specifies a suffix; by default, we use 'g' for grain.
 *
 * Here are some examples of its behavior, pretending that we use 2 decimals
 * of precision for readability:
 *
 * format(133700042n) === "1,337,000g"
 * format(133700042n, 2) === "1,337,000.42g"
 * format(133700042n, 2, "seeds") === "1,337,000.42seeds"
 * format(133700042n, 2, "") === "1,337,000.42"
 *
 */
export function format(
  grain: Grain,
  decimals: number = 0,
  suffix: string = DEFAULT_SUFFIX
): string {
  if (
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > DECIMAL_PRECISION
  ) {
    throw new Error(
      `decimals must be integer in range [0..${DECIMAL_PRECISION}]`
    );
  }
  const isNegative = grain < 0;
  let digits = [...grain.toString()];
  if (isNegative) {
    // Remove the negative sign for consistency, we'll prepend it back at the end
    digits = digits.slice(1, digits.length);
  }

  // If the number is less than one, we need to pad it with zeros at the front
  if (digits.length < DECIMAL_PRECISION + 1) {
    digits = [
      ...new Array(DECIMAL_PRECISION + 1 - digits.length).fill("0"),
      ...digits,
    ];
  }
  // If we have more than 1000 grain, then we will insert commas for
  // readability
  const integerDigits = digits.length - DECIMAL_PRECISION;
  const numCommasToInsert = Math.floor(integerDigits / 3);
  for (let i = 0; i < numCommasToInsert; i++) {
    // Count digits backwards from the last integer.
    // Since we are moving from high index to low, we don't need to adjust for
    // the fact that we're mutating the length of the array as we go... if you
    // are concerned, rest assured that this logic is tested :)
    digits.splice(integerDigits - i * 3 - 3, 0, ",");
  }
  if (decimals > 0) {
    // Insert a decimal point at the right spot
    digits.splice(digits.length - DECIMAL_PRECISION, 0, ".");
  }
  // Slice away all the unwanted precision
  digits = digits.slice(0, digits.length - DECIMAL_PRECISION + decimals);
  if (isNegative) {
    // re-insert the negative sign, if appropriate
    digits.splice(0, 0, "-");
  }
  return digits.join("") + suffix;
}

/**
 * Multiply a grain amount by a floating point number.
 *
 * Use this method when you need to multiply a grain balance by a floating
 * point number, e.g. a ratio.
 *
 * Note that this method is imprecise. It is not safe to assume, for example,
 * that `multiply(g, 1/3) + multiply(g, 2/3) === g` due to loss of precision.
 * However, the errors will be small in absolute terms (i.e. tiny compared to
 * one full grain).
 *
 * See some messy analysis of the numerical errors here:
 * https://observablehq.com/@decentralion/grain-arithmetic
 */
export function multiplyFloat(grain: Grain, num: number): Grain {
  return BigInt(Math.floor(Number(grain) * num));
}

/**
 * Approximately create a grain balance from a float.
 *
 * This method tries to convert the floating point `amt` into a grain
 * balance. For example, `grain(1)` approximately equals `ONE`.
 *
 * Do not assume this will be precise! For example, `grain(0.1337)` results in
 * `133700000000000016n`. This method is intended for test code.
 *
 * This is a shorthand for `multiplyFloat(ONE, amt)`.
 */
export function fromApproximateFloat(f: number): Grain {
  return multiplyFloat(ONE, f);
}
