// @flow

// Simple parser combinator library for structured types rather than
// bytestring parsing.

export type JsonObject =
  | string
  | number
  | boolean
  | null
  | JsonObject[]
  | {[string]: JsonObject};

export type ParseResult<+T> =
  | {|+ok: true, +value: T|}
  | {|+ok: false, +err: string|};

export class Parser<+T> {
  +_f: (JsonObject) => ParseResult<T>;
  constructor(f: (JsonObject) => ParseResult<T>) {
    this._f = f;
  }
  parse(raw: JsonObject): ParseResult<T> {
    return this._f(raw);
  }
  parseOrThrow(raw: JsonObject): T {
    const result = this.parse(raw);
    if (result.ok) {
      return result.value;
    } else {
      throw new Error(result.err);
    }
  }
}

// Helper to make a successful parse result. For readability.
function success<T>(t: T): ParseResult<T> {
  return {ok: true, value: t};
}

// Helper to make a failed parse result. For readability.
function failure(err: string): ParseResult<empty> {
  return {ok: false, err};
}

// Helper to nicely render a JSON object's typename, accounting for
// nulls and arrays.
function typename(x: JsonObject): string {
  if (x === null) {
    return "null";
  }
  if (Array.isArray(x)) {
    return "array";
  }
  return typeof x;
}

export const string: Parser<string> = new Parser((x) => {
  if (typeof x !== "string") {
    return failure("expected string, got " + typename(x));
  }
  return success(x);
});

export const number: Parser<number> = new Parser((x) => {
  if (typeof x !== "number") {
    return failure("expected number, got " + typename(x));
  }
  return success(x);
});

export const boolean: Parser<boolean> = new Parser((x) => {
  if (typeof x !== "boolean") {
    return failure("expected boolean, got " + typename(x));
  }
  return success(x);
});

// Parser that only accepts a literal `null`. (Called `null_` rather
// than `null` to avoid conflicting with keyword.)
export const null_: Parser<null> = new Parser((x) => {
  if (x !== null) {
    return failure("expected null, got " + typename(x));
  }
  return success(x);
});

export function array<T>(p: Parser<T>): Parser<T[]> {
  return new Parser((x) => {
    if (!Array.isArray(x)) {
      return failure("expected array, got " + typename(x));
    }
    const result = Array(x.length);
    for (let i = 0; i < result.length; i++) {
      const raw = x[i];
      const parsed = p.parse(raw);
      if (!parsed.ok) {
        return failure(`index ${i}: ${parsed.err}`);
      }
      result[i] = parsed.value;
    }
    return success(result);
  });
}
