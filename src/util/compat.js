// @flow

import * as C from "./combo";
export type Compatible<T> = [CompatInfo, T];
type CompatInfo = {|
  +type: string,
  +version: string,
|};

export function toCompat<T>(compatInfo: CompatInfo, obj: T): Compatible<T> {
  return [compatInfo, obj];
}

/**
 * Load an object from compatibilized state created by `toCompat`.
 * The object has an expected type and version, and may optionally have
 * handler functions for transforming previous versions into a canonical state.
 * If a handler is present for the current version, it will be applied.
 * Throws an error if the compatibilized object is the wrong type, or if its version
 * is not current and there was no handler for its version.
 */
export function fromCompat<T>(
  expectedCompatInfo: CompatInfo,
  obj: Compatible<any>,
  handlers: ?{[version: string]: (any) => T}
): T {
  if (!Array.isArray(obj) || obj.length !== 2) {
    throw new Error(
      "Tried to load object that didn't have compatibility defined"
    );
  }
  const {type, version} = obj[0];
  let result = obj[1];

  const {type: expectedType, version: expectedVersion} = expectedCompatInfo;
  if (type !== expectedType) {
    throw new Error(`Expected type to be ${expectedType} but got ${type}`);
  }

  if (handlers != null && handlers[version] != null) {
    result = handlers[version](result);
  } else if (version !== expectedVersion) {
    throw new Error(`${type}: tried to load unsupported version ${version}`);
  }
  return result;
}

const headerParser = C.object({type: C.string, version: C.string});
const wrappedParser = C.tuple([headerParser, C.raw]);

export function compatibleParser<T>(
  expectedType: string,
  handlers: {+[version: string]: C.Parser<T>}
): C.Parser<T> {
  return new C.Parser((x) => {
    const wrapResult = wrappedParser.parse(x);
    if (!wrapResult.ok) {
      return {ok: false, err: `unable to unwrap compatible: ${wrapResult.err}`};
    }
    const [{type, version}, raw] = wrapResult.value;
    if (type !== expectedType) {
      return {
        ok: false,
        err: `expected type "${expectedType}" but got "${type}"`,
      };
    }
    if (!Object.prototype.hasOwnProperty.call(handlers, version)) {
      return {ok: false, err: `no "${type}/${version}" handler`};
    }
    const parseResult = handlers[version].parse(raw);
    if (parseResult.ok) {
      return parseResult;
    } else {
      return {ok: false, err: `${type}/${version}: ${parseResult.err}`};
    }
  });
}
