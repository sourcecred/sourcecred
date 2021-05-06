// @flow

/**
 * Utilities for working with nullable types: `?T = T | null | void`.
 *
 * These functions use the native runtime representation, as opposed to
 * creating an `Optional<T>` wrapper class. This ensures that they have
 * minimal runtime cost (just a function call), and that they are
 * trivially interoperable with other code.
 *
 * When a value of type `?T` is `null` or `undefined`, we say that it is
 * _absent_. Otherwise, it is _present_.
 *
 * Some functions that typically appear in such libraries are not
 * needed:
 *
 *   - `join` (`??T => ?T`) can be implemented as the identity function,
 *     because the Flow types `??T` and `?T` are equivalent;
 *   - `flatMap` (`?T => (T => ?U) => ?U`) can be implemented simply as
 *     `map`, again because `??T` and `?T` are equivalent;
 *   - `first` (`?T => ?T => ?T`) can be implemented simply as `orElse`,
 *     again because `??T` and `?T` are equivalent;
 *   - `isPresent` (`?T => boolean`) doesn't provide much value over the
 *     equivalent abstract disequality check;
 *   - constructors like `empty` (`() => ?T`) and `of` (`T => ?T`) are
 *     entirely spurious.
 *
 * Other functions could reasonably be implemented, but have been left
 * out because they have rarely been needed:
 *
 *   - `filter` (`?T => (T => boolean) => ?T`);
 *   - `forEach` (`?T => (T => void) => void`);
 *   - `orElseGet` (`?T => (() => T) => T`), which is useful in the case
 *      where constructing the default value is expensive.
 *
 * (Of these three, `orElseGet` would probably be the most useful for
 * our existing codebase.)
 */

/**
 * Apply the given function inside the nullable. If the input is absent,
 * then it will be returned unchanged. Otherwise, the given function
 * will be applied.
 */
export function map<T, U>(x: ?T, f: (T) => U): ?U {
  return x != null ? f(x) : x;
}

/**
 * Extract the value from a nullable. If the input is present, it will
 * be returned. Otherwise, an error will be thrown with the provided
 * message (defaulting to the string representation of the absent input).
 */
export function get<T>(x: ?T, errorMessage?: string): T {
  if (x == null) {
    throw new Error(errorMessage != null ? errorMessage : String(x));
  } else {
    return x;
  }
}

/**
 * Extract the value from a nullable. If the input is present, it will
 * be returned. Otherwise, an error will be thrown, with message given
 * by the provided function.
 */
export function orThrow<T>(x: ?T, getErrorMessage: () => string): T {
  if (x == null) {
    throw new Error(getErrorMessage());
  } else {
    return x;
  }
}

/**
 * Extract the value from a nullable, using the provided default value
 * in case the input is absent.
 */
export function orElse<T>(x: ?T, defaultValue: T): T {
  return x != null ? x : defaultValue;
}

/**
 * Filter nulls and undefined out of an array, returning a new array.
 *
 * The functionality is easy to implement without a util method (just call
 * `filter`); however Flow doesn't infer the type of the output array based on
 * the callback that was passed to filter. This method basically wraps filter
 * in a type-aware way.
 */
export function filterList<T>(xs: $ReadOnlyArray<?T>): T[] {
  // A type-safe way to implement this would be:
  /*:: (xs.flatMap((x) => x == null ? [] : [x]): T[]); */
  // For performance, we instead take an unsafe route.
  return ((xs.filter((x) => x != null): any): T[]);
}
