// @flow

/* global BigInt */

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
 * For a finite normal 64-bit float `f`, extracts integers `sgn`,
 * `exponent`, and `mantissa` such that:
 *
 *   - `sgn` is -1 or +1
 *   - `exponent` is between -1023 and 1024, inclusive
 *   - `mantissa` is between 0 and 2^51 - 1, inclusive
 *   - the number given by `f` equals `sgn * 2^exponent * (1 + mantissa / 2^52)`
 *
 * The results are all bigints within the range of safe integers for
 * 64-bit floats (i.e., converting them to `Number` is lossless).
 *
 * Throws an error if `f` is subnormal (biased exponent is 0).
 */
function decomposeFloat(
  f: number
): {|sgn: number, exponent: number, mantissa: number|} {
  if (!isFinite(f)) {
    throw new Error("Input must be finite: " + f);
  }
  const union = new DataView(new ArrayBuffer(8));
  const littleEndian = true; // arbitrary, but faster when matches native arch
  union.setFloat64(0, f, littleEndian);
  // $ExpectFlowError
  const bytes = union.getBigUint64(0, littleEndian);
  // $ExpectFlowError
  const sgn = (-1n) ** (bytes >> 63n);
  // $ExpectFlowError
  const biasedExponent = (bytes & ~(1n << 63n)) >> 52n;
  // $ExpectFlowError
  if (biasedExponent === 0n) {
    throw new Error("Subnormal floats not supported: " + f);
  }
  // $ExpectFlowError
  const exponent = biasedExponent - 1023n;
  // $ExpectFlowError
  const mantissa = bytes & ((1n << 52n) - 1n);
  return {sgn, exponent, mantissa};
}

/**
 * Multiply a grain amount by a floating point number.
 *
 * Use this method when you need to multiply a grain balance by a floating
 * point number, e.g. a ratio.
 *
 * This function is exact in the first argument and subject to the usual
 * floating point considerations in the second. Thus, it is the case
 * that
 *
 *      multiplyFloat(g, 1) === g
 *      multiplyFloat(g, x) + multiplyFloat(h, f) === multiplyFloat(g + h, x)
 *      multiplyFloat(k * g, x) === k * multiplyFloat(g, x)
 *
 * for all `BigInt`s `k`, `g`, and `h` and all floats `x`. But it is not
 * necessarily the case that
 *
 *      multiplyFloat(g, x) + multiplyFloat(g, y) === multiplyFloat(g, x + y)
 *
 * for all `BigInt`s `g` and floats `x` and `y`: e.g., when `x === 1`
 * and `y === 1e-16`, we have `x + y === x` even though `y !== 0`.
 */
export function multiplyFloat(g: Grain, fac: number) {
  if (fac === 0) {
    // Special case, as 0 is subnormal.
    // $ExpectFlowError
    return 0n;
  }
  const {sgn, exponent, mantissa} = decomposeFloat(fac);
  // from `decomposeFloat` contract, `fac = numerator / denominator`
  // exactly (in arbitrary-precision arithmetic)
  // $ExpectFlowError
  const numerator = sgn * 2n ** (exponent + 1023n) * (2n ** 52n + mantissa);
  // $ExpectFlowError
  const denominator = 2n ** (1023n + 52n);
  // round to nearest, biasing toward zero on exact tie
  // $ExpectFlowError
  return (2n * numerator * g + sgn * denominator) / (2n * denominator);
}

/**
 * Aproximately create a grain balance from a float.
 *
 * This method tries to convert the floating point `amt` into a grain
 * balance. For example, `grain(1)` approximately equals `ONE`.
 *
 * Do not assume this will be precise! For example, `grain(0.1337)` results in
 * `133700000000000016n`. This method is intended for test code.
 *
 * This is a shorthand for `multiplyFloat(ONE, amt)`.
 */
export function fromFloat(f: number): Grain {
  return multiplyFloat(ONE, f);
}
