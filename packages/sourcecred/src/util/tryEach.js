// @flow

type ExtractReturnType = <V>(() => V) => V;

/*
  Takes several functions and returns the result of the first one that doesn't
  throw, or throws the error of the last function if all of the functions throw.
*/
export default function tryEach<T>(...funcs: Array<() => T>): T {
  for (const [i, f] of funcs.entries()) {
    try {
      return f();
    } catch (e) {
      if (i >= funcs.length - 1) throw e;
      else
        console.log(
          "Failure occurred but trying alternative.\n" + (e.message || e)
        );
    }
  }
  throw "This should not be reached.";
}
