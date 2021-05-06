// @flow

import * as C from "./combo";

/**
 * We have a convention of using TimestampMs as our default representation.
 * However TimestampISO has the benefit of being human readable / writable,
 * so it's used for serialization and display as well.
 * We'll validate types at runtime, as there's a fair chance we'll use these
 * functions to parse data that came from a Flow `any` type (like JSON).
 */

// A timestamp representation in ms since epoch.
export type TimestampMs = number;

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
  const timestampMs: TimestampMs = validateTimestampMs(timestampLike);
  return new Date(timestampMs).toISOString();
}

/**
 * Creates a TimestampMs from a TimestampISO.
 */
export function fromISO(timestampISO: TimestampISO | string): TimestampMs {
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
 * Validate that a number is potentially a valid timestamp.
 *
 * This checks that the number is a finite integer, which avoids some potential
 * numbers that are not valid timestamps.
 */
export function validateTimestampMs(timestampMs: number): TimestampMs {
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

export function validateTimestampISO(timestampISO: string): TimestampISO {
  // Verify that it can be converted without throwing an error
  fromISO(timestampISO);
  return timestampISO;
}

export const timestampMsParser: C.Parser<TimestampMs> = C.fmap(
  C.number,
  validateTimestampMs
);
export const timestampISOParser: C.Parser<TimestampISO> = C.fmap(
  C.string,
  validateTimestampISO
);
