// @flow

import * as P from "../../util/combo";
import bigInt from "big-integer";
import {DEFAULT_SUFFIX} from "../../api/currencyConfig";

/**
 * This module contains the types for tracking Grain, which is the native
 * project-specific, cred-linked token created in SourceCred instances. In
 * practice, projects can call these tokens anything they want, but we will
 * refer to the tokens as "Grain" throughout the codebase. The conserved
 * properties of all Grains are that they are minted/distributed based on cred
 * scores, and that they can be used to Boost contributions in a cred graph.
 *
 * We track Grain using big integer arithmetic, so that we can be precise with
 * Grain values and avoid float imprecision issues. Following the convention of
 * ERC20 tokens, we track Grain at 18 decimals of precision, although we can
 * make this project-specific if there's a future need.
 *
 * At rest, we represent Grain as strings. This is a convenient decision around
 * serialization boundaries, so that we can just directly stringify objects containing
 * Grain values and it will Just Work. The downside is that we need to convert them to/fro
 * string representations any time we need to do Grain arithmetic, which could create
 * perf hot spots. If so, we can factor out the hot loop and do them in a way
 * that has less overhead. You can see context for this decision in [#1936] and [#1938].
 *
 * Ideally, we would just use the native [BigInt] type. However, at time of
 * writing it's not well supported by [flow] or Safari, so we use the
 * big-integer library. That library delegates out to native BigInt when
 * available, so this should be fine.
 *
 * Since the big-integer library does have a sensible `toString` method defined
 * on the integers, we could switch to representing Grain at rest via
 * big-integers rather than as strings. However, this would require re-writing
 * a lot of test code. If perf becomes an issue that would be a principled fix.
 *
 * [BigInt]: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt
 * [flow]: https://github.com/facebook/flow/issues/6639
 * [#1936]: https://github.com/sourcecred/sourcecred/pull/1936
 * [#1938]: https://github.com/sourcecred/sourcecred/pull/1938
 */
export opaque type Grain: string = string;

export const ZERO: Grain = "0";

// How many digits of precision there are in "one" grain
export const DECIMAL_PRECISION = 18;

// One "full" grain
export const ONE: Grain = bigInt(10).pow(DECIMAL_PRECISION).toString();

export function add(a: Grain, b: Grain): Grain {
  return bigInt(a).plus(bigInt(b)).toString();
}
export function sub(a: Grain, b: Grain): Grain {
  return bigInt(a).subtract(bigInt(b)).toString();
}
export function mul(a: Grain, b: Grain | number): Grain {
  return bigInt(a).times(bigInt(b)).toString();
}
export function div(a: Grain, b: Grain | number): Grain {
  return bigInt(a).divide(bigInt(b)).toString();
}
export function lt(a: Grain, b: Grain): boolean {
  return bigInt(a).lt(bigInt(b));
}
export function gt(a: Grain, b: Grain): boolean {
  return bigInt(a).gt(bigInt(b));
}
export function lte(a: Grain, b: Grain): boolean {
  return bigInt(a).leq(bigInt(b));
}
export function gte(a: Grain, b: Grain): boolean {
  return bigInt(a).geq(bigInt(b));
}
export function eq(a: Grain, b: Grain): boolean {
  return bigInt(a).eq(bigInt(b));
}

export function fromString(s: string): Grain {
  return bigInt(s).toString();
}

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
  const isNegative = grain[0] === "-";
  let digits = [...grain];
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
  const numCommasToInsert = Math.floor((integerDigits - 1) / 3);
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
 * Formats a grain balance as a human-readable number using the format()
 * method, but trims any unnecessary decimal information.
 *
 * The intended use is for UI presentation where less visual clutter is
 * desired.
 *
 * Here are some examples of its behavior
 *
 * format(100000000000000) === "0.0001g"
 * format(150000000000000000000) === "150g"
 * format(15000000000000000000000) === "15,000g"
 * format(15000000000000000000000, "seeds") === "15,000seeds"
 * format(15000000000000000000000, "") === "15,000"
 *
 */
export function formatAndTrim(
  grain: Grain,
  suffix: string = DEFAULT_SUFFIX
): string {
  return format(grain, DECIMAL_PRECISION, "").replace(/\.?0+$/, "") + suffix;
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
  if (!isFinite(num)) {
    throw new Error(`invalid input: num is ${num}`);
  }
  if (num === 1) {
    // The one case where we can be sure to return a correct answer :)
    return grain;
  }

  const floatProduct = Number(grain) * num;
  return bigInt(Math.floor(floatProduct)).toString();
}

/**
 * Convert an integer number (in floating-point representation) into a precise
 * Grain value.
 */
export function fromInteger(x: number): Grain {
  if (!isFinite(x) || Math.floor(x) !== x) {
    throw new Error(`not an integer: ${x}`);
  }
  return bigInt(ONE).times(bigInt(x)).toString();
}

/**
 * Accept human-readable numbers strings and convert them to precise grain amounts
 *
 * This is most useful for processing form input values before passing them
 * into the ledger, since all form fields return strings
 *
 * In this case, a "float string" is a string that returns a number value
 * when passed into `parseFloat`
 *
 * The reason to circumvent any floating point values is to avoid losses in
 * precision. By modifying the string directly in a predictable pattern, we can
 * convert uer-generated floating point values to grain at full fidelity, and avoid
 * any fuzzy floating point arithmetic
 *
 * The tradeoff here is around versatility. Values with more decimals than the
 * allowable precision will yield an error when passed in.
 */
export function fromFloatString(
  x: string,
  precision: number = DECIMAL_PRECISION
): Grain {
  if (typeof x !== "string") {
    throw new Error(`not a string: ${x}`);
  }
  if (!(isFinite(x) && x.trim())) {
    throw new Error(`input not a valid number: ${x}`);
  }

  const [whole = "", dec = ""] = x.split(".");
  if (dec.length > precision) {
    throw new Error(
      `Provided decimals ${dec.length} exceed allowable precision ${precision}`
    );
  }
  const paddedDecimal = dec.padEnd(precision, "0");

  return bigInt(`${whole}${paddedDecimal}`).toString();
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

/**
 * Approximates the division of two grain values
 *
 * This naive implementation of grain division converts the given values
 * to floats and performs simple floating point division.
 *
 * Do not assume this will be precise!
 */
export function toFloatRatio(numerator: Grain, denominator: Grain): number {
  return Number(numerator) / Number(denominator);
}

/**
 * Splits a budget of Grain proportional to floating-point scores.
 *
 * splitBudget guarantees that the total amount distributed will precisely
 * equal the budget. This is a surprisingly challenging property to ensure, and
 * it explains the complexity of this algorithm. We stress-test the method with
 * extremely uneven share distribution (e.g. a split where some users' scores
 * are 10**100 larger than others).
 *
 * The algorithm can be arbitrarily unfair at the atto-Grain level; for
 * example, in the case `splitBudget(fromString("1"), [1, 100])` it will give
 * all the Grain to the first account, even though it only has 1/100th the score
 * of the second account. However, since Grain is tracked with 18 decimal point
 * precision, these tiny biases mean very little in practice. In testing, when
 * splitting one full Grain (i.e. 10**18 attoGrain), we haven't seen discrepancies
 * over ~100 attoGrain, or one billion-million-th of a full Grain.
 */
export function splitBudget(
  budget: Grain,
  scores: $ReadOnlyArray<number>
): $ReadOnlyArray<Grain> {
  if (lt(budget, ZERO)) {
    throw new Error("negative budget");
  }
  const totalScore = scores.reduce((a, b) => a + b, 0);
  if (!isFinite(totalScore)) {
    throw new Error(`scores must all be finite, got: ${totalScore}`);
  }
  if (totalScore <= 0) {
    throw new Error(`total score must be positive, got: ${totalScore}`);
  }

  let scoreRemaining = totalScore;
  let budgetRemaining = budget;
  const pieces = scores.map((s) => {
    if (s < 0) {
      throw new Error("negative score: " + s);
    }
    if (s === 0 || scoreRemaining === 0) {
      // You would think that s === 0 implies scoreRemaining === 0, but
      // testing in extreme circumstances reveals that both checks are needed.
      return "0";
    }
    let fraction = s / scoreRemaining;
    if (fraction > 1) {
      fraction = 1;
    }
    const piece = multiplyFloat(budgetRemaining, fraction);

    /**
     * Uncomment below if you want to measure the discrepancy caused by
     * forcing fracion=1 whenever fraction > 1.
     *
     * In testing, when distributing one full Grain across wildly unequal
     * scores, it never produced more than ~hundreds of attoGrain discrepancy.
     */
    /*
    const altPiece = multiplyFloat(budgetRemaining, s / scoreRemaining);
    if (altPiece !== piece) {
      const delta = sub(altPiece, piece);
      console.error(
        `${delta} discrepancy due to capping ${s} / ${scoreRemaining} from ${
          s / scoreRemaining
        } to 1`
      );
    }
    */

    budgetRemaining = sub(budgetRemaining, piece);
    scoreRemaining -= s;
    return piece;
  });

  // istanbul ignore if
  if (lt(budgetRemaining, "0")) {
    // Per the contract of the function, this should never happen.
    throw new Error("invariant error: budget overspent: " + budgetRemaining);
  }
  if (gt(budgetRemaining, "0")) {
    /**
     * Uncomment below if you want to measure the discrepancy caused by this
     * "giveaway-leftovers" approach. In testing, when run with wildly varying
     * shares, it never produced more than ~hundreds of attoGrain discrepancy.
     */
    /*
    console.error(
      `${budgetRemaining} discrepancy being resolved via giveaway to last share`
    );
    */
    pieces[pieces.length - 1] = add(pieces[pieces.length - 1], budgetRemaining);
  }
  return pieces;
}

/**
 * Sum a sequence of Grain values.
 */
export function sum(xs: Iterable<Grain>): Grain {
  let total = bigInt(0);
  for (const x of xs) {
    total = total.add(bigInt(x));
  }
  return total.toString();
}

export const parser: P.Parser<Grain> = P.fmap(P.string, fromString);
