// @flow

// Simple parser combinator library for structured types rather than
// bytestring parsing.

export type JsonObject =
  | string
  | number
  | boolean
  | null
  | $ReadOnlyArray<JsonObject>
  | {+[string]: JsonObject};

export type ParseResult<+T> =
  | {|+ok: true, +value: T|}
  | {|+ok: false, +err: string|};

export class Parser<+T> {
  +_f: (JsonObject) => ParseResult<T>;
  // Phantom data for the output type of this parser. Used to more
  // reliably match on parsers at the type level, via `$PropertyType`
  // rather than `$Call`. Not populated at runtime; do not dereference.
  +_phantomT: T;

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

// Helper type to extract the underlying type of a parser: for instance,
// `ParserOutput<Parser<string>>` is just `string`.
export type ParserOutput<P: Parser<mixed>> = $PropertyType<P, "_phantomT">;
type ExtractParserOutput = <P: Parser<mixed>>(P) => ParserOutput<P>;

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

export const integer: Parser<number> = new Parser((x) => {
  if (typeof x !== "number" || Math.floor(x) !== x) {
    return failure("expected integer, got " + typename(x));
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

// The identity operation: a parser that always succeeds, emitting a
// `JsonObject` (not `any`) with the input. Used when you need a parser
// that matches anything:
//
//    // Accepts an arbitrary heterogeneous array and returns its length
//    C.fmap(C.array(C.raw), (a) => a.length)
//
//    // Accepts a config file with dynamic plugin-specific data
//    C.object({version: string, pluginConfig: C.dict(C.raw)})
//
// To destructure the parsed value dynamically, pair with `fmap`.
export const raw: Parser<JsonObject> = new Parser(success);

// Lift a plain value into a parser that always returns that value,
// ignoring its input.
export function pure<T>(t: T): Parser<T> {
  return new Parser((_) => success(t));
}

// Create a parser that accepts any value from a fixed set. This can be
// used for enumerated values in configs:
//
//    type Environment = "dev" | "prod";
//    const p: C.Parser<Environment> = C.exactly(["dev", "prod"]);
//
// This function only supports value types. Performing an `any`-cast
// guarded by a deep equality check would be unsound, breaking opaque
// type boundaries: e.g., a module could `export opaque type T = {}` and
// provide two constants `ONE = {}` and `TWO = {}` (different objects),
// and then expect that any value of type `T` would be identical to
// either `ONE` or `TWO`. Using strict reference equality for array and
// object types would be sound, but would not usually be what was
// wanted, as it wouldn't match ~any actual output of `JSON.parse`.
export function exactly<T: string | number | boolean | null>(
  ts: $ReadOnlyArray<T>
): Parser<T> {
  return new Parser((x) => {
    for (const t of ts) {
      if (x === t) {
        return success(t);
      }
    }
    const expected: string =
      ts.length === 1 ? String(ts[0]) : `one of ${JSON.stringify(ts)}`;
    return failure(`expected ${expected}, got ${typename(x)}`);
  });
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

// Create a parser that tries each of the given parsers on the same
// input, taking the first successful parse or failing if all parsers
// fail. In the failure case, the provided `errorFn` will be called with
// the error messages from all the subparsers to form the resulting
// error; the default error function includes the full text of all the
// error messages, but a user-supplied error function may act with
// domain-specific precision.
//
// One use case is for parsing unions, including discriminated unions:
//
//    type Expr =
//      | {|+type: "CONSTANT", +value: number|}
//      | {|+type: "VARIABLE", +name: string|};
//    const exprParser: C.Parser<Expr> = C.orElse([
//      C.fmap(C.number, (value) => ({type: "CONSTANT", value})),
//      C.fmap(C.string, (name) => ({type: "VARIABLE", name})),
//    ]);
//
// Another is to use `pure` to provide a default value:
//
//    const lenientNumber: C.Parser<number | "(unknown)"> = C.orElse([
//      C.number,
//      C.pure("(unknown)"),
//    ]);
//
// This last parser will always succeed, because `C.pure(v)` always
// succeeds and always returns `v`.
export function orElse<T: $ReadOnlyArray<Parser<mixed>>>(
  parsers: T,
  errorFn?: (string[]) => string = (errors) =>
    `no parse matched: ${JSON.stringify(errors)}`
): Parser<$ElementType<$TupleMap<T, ExtractParserOutput>, number>> {
  return new Parser((x) => {
    const errors = [];
    for (const parser of parsers) {
      const result = parser.parse(x);
      if (result.ok) {
        return success((result.value: any));
      } else {
        errors.push(result.err);
      }
    }
    return failure(errorFn(errors));
  });
}

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

// Fields for an object type. Each is either a bare parser or the result
// of `rename("oldFieldName", p)` for a parser `p`, to be used when the
// field name in the output type is to be different from the field name
// in the input type.
export type Field<+T> = Parser<T> | RenameField<T>;
export opaque type RenameField<+T>: {+_phantomT: T} = RenameFieldImpl<T>;
export type Fields = {+[string]: Field<mixed>};

// Like `ExtractParserOutput`, but works on `Field`s even when the
// bound ascription is checked outside of this module.
type FieldOutput<F: Field<mixed>> = $PropertyType<F, "_phantomT">;
type ExtractFieldOutput = <F: Field<mixed>>(F) => FieldOutput<F>;

export function rename<T>(oldKey: string, parser: Parser<T>): RenameField<T> {
  return new RenameFieldImpl(oldKey, parser);
}

class RenameFieldImpl<+T> extends Parser<T> {
  +oldKey: string;
  constructor(oldKey: string, parser: Parser<T>) {
    super(parser._f);
    this.oldKey = oldKey;
  }
}

// Parser combinator for an object type all of whose fields are
// required.
type PObjectAllRequired = <FReq: Fields>(
  required: FReq
) => Parser<$ObjMap<FReq, ExtractFieldOutput>>;

// Parser combinator for an object type with some required fields (maybe
// none) and some optional ones.
type PObjectWithOptionals = <FReq: Fields, FOpt: Fields>(
  required: FReq,
  optional: FOpt
) => Parser<
  $Exact<{
    ...$Exact<$ObjMap<FReq, ExtractFieldOutput>>,
    ...$Rest<$Exact<$ObjMap<FOpt, ExtractFieldOutput>>, {}>,
  }>
>;

// Parser combinator for an object type where all fields are optional.
// Special case of `PObjectWithOptionals`.
type PObjectShape = <FOpt: Fields>(
  optional: FOpt
) => Parser<$Rest<$Exact<$ObjMap<FOpt, ExtractFieldOutput>>, {}>>;

// Parser combinator for an object type with some required fields (maybe
// none) and maybe some optional ones. (This is an intersection type
// rather than a normal function with optional second argument to force
// inference to pick a branch based on arity rather than inferring an
// `empty` type.)
type PObject = PObjectAllRequired & PObjectWithOptionals;

// Create a parser for an object type, with required fields and
// (optionally) optional fields. The returned parser will silently drop
// extraneous fields on values that it parses, to facilitate forward and
// backward compatibility.
export const object: PObject = (function object(
  requiredFields,
  optionalFields?
) {
  const newKeysSeen = new Set();
  const fields: Array<{|
    +oldKey: string,
    +newKey: string,
    +required: boolean,
    +parser: Parser<mixed>,
  |}> = [];
  const fieldsets = [
    {inputFields: requiredFields, required: true},
    {inputFields: optionalFields || {}, required: false},
  ];
  for (const {inputFields, required} of fieldsets) {
    for (const newKey of Object.keys(inputFields)) {
      const parser = inputFields[newKey];
      if (newKeysSeen.has(newKey)) {
        throw new Error("duplicate key: " + JSON.stringify(newKey));
      }
      newKeysSeen.add(newKey);
      const oldKey = parser instanceof RenameFieldImpl ? parser.oldKey : newKey;
      fields.push({oldKey, newKey, parser, required});
    }
  }
  return new Parser((x) => {
    if (typeof x !== "object" || Array.isArray(x) || x == null) {
      return failure("expected object, got " + typename(x));
    }
    const result = {};
    for (const {oldKey, newKey, parser, required} of fields) {
      const raw = x[oldKey];
      if (raw === undefined) {
        if (required) {
          return failure("missing key: " + JSON.stringify(oldKey));
        } else {
          continue;
        }
      }
      const parsed = parser.parse(raw);
      if (!parsed.ok) {
        return failure(`key ${JSON.stringify(oldKey)}: ${parsed.err}`);
      }
      result[newKey] = parsed.value;
    }
    return success(result);
  });
}: any);

// Create a parser for an object type all of whose fields are optional.
// Shorthand for `object` with an empty first argument.
export const shape: PObjectShape = function shape(fields) {
  return object({}, fields);
};

// Create a parser for a tuple: a fixed-length array with possibly
// heterogeneous element types. For instance,
//
//    C.tuple([C.string, C.number, C.boolean])
//
// is a parser that accepts length-3 arrays whose first element is a
// string, second element is a number, and third element is a boolean.
export function tuple<T: Iterable<Parser<mixed>>>(
  parsers: T
): Parser<$TupleMap<T, ExtractParserOutput>> {
  const ps = Array.from(parsers);
  return new Parser((x) => {
    if (!Array.isArray(x)) {
      return failure("expected array, got " + typename(x));
    }
    if (x.length !== ps.length) {
      return failure(`expected array of length ${ps.length}, got ${x.length}`);
    }
    const result = Array(ps.length);
    for (let i = 0; i < result.length; i++) {
      const raw = x[i];
      const parser = ps[i];
      const parsed = parser.parse(raw);
      if (!parsed.ok) {
        return failure(`index ${i}: ${parsed.err}`);
      }
      result[i] = parsed.value;
    }
    return success(result);
  });
}

// Parser combinator for a dictionary whose keys are arbitrary strings.
type PDictStringKey = <V>(Parser<V>) => Parser<{|[string]: V|}>;
// Parser combinator for a dictionary whose keys are a specified subtype
// of string.
type PDictCustomKey = <V, K: string>(
  Parser<V>,
  Parser<K>
) => Parser<{|[K]: V|}>;
type PDict = PDictStringKey & PDictCustomKey;

// Create a parser for objects with arbitrary string keys and
// homogeneous values. For instance, a set of package versions:
//
//    {"better-sqlite3": "^7.0.0", "react": "^16.13.0"}
//
// might be parsed by the following parser:
//
//    C.dict(C.fmap(C.string, (s) => SemVer.parse(s)))
//
// Objects may have any number of entries, including zero.
//
// An optional second argument may be passed to refine the keys to a
// subtype of `string`, such as an opaque subtype (`NodeAddressT`) or a
// string enum (`"ONE" | "TWO"`). Fails if the key parser gives the same
// output for two distinct keys.
export const dict: PDict = (function dict<V, K: string>(
  valueParser,
  keyParser: Parser<K> = (string: any) // safe when called as `PDict`
): Parser<{[K]: V}> {
  return new Parser((x) => {
    if (typeof x !== "object" || Array.isArray(x) || x == null) {
      return failure("expected object, got " + typename(x));
    }
    const rawKeys: Map<K, string> = new Map();
    const result: {|[K]: V|} = ({}: any);
    for (const rawKey of Object.keys(x)) {
      const parsedKey = keyParser.parse(rawKey);
      if (!parsedKey.ok) {
        return failure(`key ${JSON.stringify(rawKey)}: ${parsedKey.err}`);
      }
      const oldRawKey = rawKeys.get(parsedKey.value);
      if (oldRawKey != null) {
        const s = JSON.stringify;
        return failure(
          `conflicting keys ${s(oldRawKey)} and ${s(rawKey)} ` +
            `both have logical key ${s(parsedKey.value)}`
        );
      }
      rawKeys.set(parsedKey.value, rawKey);
      const rawValue = x[rawKey];
      const parsedValue = valueParser.parse(rawValue);
      if (!parsedValue.ok) {
        return failure(`value ${JSON.stringify(rawKey)}: ${parsedValue.err}`);
      }
      result[parsedKey.value] = parsedValue.value;
    }
    return success(result);
  });
}: any);

export const delimited: (string) => Parser<string> = (delimiter) =>
  fmap(string, (s) => s.split(delimiter)[0]);
