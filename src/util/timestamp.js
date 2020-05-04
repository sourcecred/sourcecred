// @flow

/**
 * We have a convention of using TimestampMs as our default representation.
 * However TimestampISO has the benefit of being human readable / writable,
 * so it's used for serialization and display as well.
 * We'll validate types at runtime, as there's a fair chance we'll use these
 * functions to parse data that came from a Flow `any` type (like JSON).
 */

// A timestamp representation in ms since epoch.
export opaque type TimestampMs: number = number;

// A timestamp representation in ISO 8601 format.
export opaque type TimestampISO: string = string;

/**
 * Creates a TimestampISO from a TimestampMs-like input.
 *
 * Since much of the previous types have used `number` as a type instead of
 * TimestampMs. Accepting `number` will give an easier upgrade path, rather
 * than a forced refactor across the codebase.
 */
export function toISO(timestampLike: TimestampMs | number): TimestampISO {
  const timestampMs: TimestampMs = fromNumber(timestampLike);
  return new Date(timestampMs).toISOString();
}

/**
 * Creates a TimestampMs from a TimestampISO.
 */
export function fromISO(timestampISO: TimestampISO): TimestampMs {
  if (typeof timestampISO !== "string") {
    throw new TypeError(
      `TimestampISO values must be strings, ` +
        `received: ${String(timestampISO)}`
    );
  }
  const parsed = Date.parse(timestampISO);
  if (Number.isNaN(parsed)) {
    throw new RangeError(
      `Could not parse TimestampISO, are you sure it's a valid ISO format? ` +
        `received: ${String(timestampISO)}`
    );
  }
  return parsed;
}

/**
 * Creates a TimestampMs from a number input.
 *
 * Since much of the previous types have used `number` as a type instead of
 * TimestampMs. Accepting `number` will give an easier upgrade path, rather
 * than a forced refactor across the codebase.
 */
export function fromNumber(timestampMs: number): TimestampMs {
  const asNumber = Number(timestampMs);
  if (
    timestampMs === null ||
    timestampMs === undefined ||
    !Number.isInteger(asNumber)
  ) {
    throw new TypeError(
      `Numbers representing TimestampMs values must be finite integers, ` +
        `received: ${String(timestampMs)}`
    );
  }
  return new Date(asNumber).valueOf();
}
