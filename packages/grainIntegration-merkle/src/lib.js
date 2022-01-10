// @flow

const DEFAULT_SUFFIX = "g";
const DEFAULT_DECIMAL_PRECISION = 18;

export opaque type Grain: string = string;

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
  grain: Grain | string,
  decimals: number = 0,
  suffix: string = DEFAULT_SUFFIX,
  precision: number = DEFAULT_DECIMAL_PRECISION
): string {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > precision) {
    throw new Error(`decimals must be integer in range [0..${precision}]`);
  }
  const isNegative = grain[0] === "-";
  let digits = [...grain];
  if (isNegative) {
    // Remove the negative sign for consistency, we'll prepend it back at the end
    digits = digits.slice(1, digits.length);
  }

  // If the number is less than one, we need to pad it with zeros at the front
  if (digits.length < precision + 1) {
    digits = [...new Array(precision + 1 - digits.length).fill("0"), ...digits];
  }
  // If we have more than 1000 grain, then we will insert commas for
  // readability
  const integerDigits = digits.length - precision;
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
    digits.splice(digits.length - precision, 0, ".");
  }
  // Slice away all the unwanted precision
  digits = digits.slice(0, digits.length - precision + decimals);
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
 * formatAndTrim(100000000000000) === "0.0001g"
 * formatAndTrim(150000000000000000000) === "150g"
 * formatAndTrim(15000000000000000000000) === "15,000g"
 * formatAndTrim(15000000000000000000000, "seeds") === "15,000seeds"
 * formatAndTrim(15000000000000000000000, "") === "15,000"
 *
 */
export function formatAndTrim(
  grain: Grain | string,
  precision: number = DEFAULT_DECIMAL_PRECISION,
  suffix: string = DEFAULT_SUFFIX
): string {
  return format(grain, precision, "").replace(/\.?0+$/, "") + suffix;
}

export const formatTimestamp = (
  timestamp: number,
  opts?: Intl$DateTimeFormatOptions
): string =>
  new Date(timestamp).toLocaleString("en", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "numeric",
    ...opts
  });
