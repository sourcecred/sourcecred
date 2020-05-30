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

<<<<<<< HEAD
// Lift a plain value into a parser that always returns that value,
// ignoring its input.
export function pure<T>(t: T): Parser<T> {
  return new Parser((_) => success(t));
}

// Transform the output of a parser with a pure function. For instance,
// if `p: Parser<number>` and `f = (n: number) => n % 2 === 0`, then
// `fmap(p, f)` is a `Parser<boolean>` that first uses `p` to parse its
// input to a number and then checks whether the number is even.
//
// If the function `f` throws, the thrown value will be converted to
// string and returned as a parse error. (The string conversion takes
// `e.message` if the thrown value `e` is an `Error`, else just converts
// with the `String` builtin.)
//
// This can be used for "strong validation". If `U` is a (possibly
// opaque) subtype of `T`, and `f: (T) => U` is a checked downcast that
// either returns a `U` or throws an error, then `fmap` can transform a
// `Parser<T>` into a validating `Parser<U>`, where the fact that the
// validation has been performed is encoded at the type level. Thus:
//
//    import * as C from ".../combo";
//    import {NodeAddress, type NodeAddressT} from ".../core/graph";
//
//    const addressParser: Parser<NodeAddressT> =
//      C.fmap(C.array(C.string), NodeAddress.fromParts);
//
// As a degenerate case, it can also be used for "weak validation",
// where the types `T` and `U` are the same and the function `f` simply
// returns its argument or throws, but in this case there is nothing
// preventing a user of a `Parser<T>` from simply forgetting to
// validate. Prefer strong validation when possible.
export function fmap<T, U>(p: Parser<T>, f: (T) => U): Parser<U> {
  return new Parser((x) => {
    const maybeT = p.parse(x);
    if (!maybeT.ok) {
      return failure(maybeT.err);
    }
    const t = maybeT.value;
    let u: U;
    try {
      u = f(t);
    } catch (e) {
      if (e instanceof Error) {
        return failure(e.message);
      } else {
        return failure(String(e));
      }
    }
    return success(u);
  });
}

=======
>>>>>>> 297c4e915670fe63c171f06022fa665598b7524a
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
