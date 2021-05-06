// @flow

// This module reimplements Node's `require("path").posix.normalize`
// function, so that it can be bundled in the browser.
//
// The code is copied directly from the Node implementation in
// `lib/path.js` at Git commit e0395247c899af101f8a1f76a8554be1ff14040a.
// The code being copied is published under the MIT License.
//
// The `normalize` function and its transitive dependencies are
// included. Flow types have been added where necessary, and the code
// has been run through Prettier. Declarations with `var` have been
// changed to `let` or `const`. Added comments are marked with `NOTE`.
// The rest of the code is verbatim except where noted.

// NOTE(@wchargin): The following documentation comment is adapted from
// the Node documentation in `doc/api/path.md` (at the aforementioned
// Git commit).

/**
 * Normalize the given POSIX path, resolving ".." and "." segments.
 *
 * When multiple, sequential forward slashes are found, they are
 * replaced by a single forward slash. A trailing forward slash is
 * preserved if present, but not added if absent.
 *
 * If the path is a zero-length string, "." is returned, representing
 * the current working directory.
 *
 * A `TypeError` is thrown if `path` is not a string.
 */
export default function normalize(path: string): string {
  assertPath(path);

  if (path.length === 0) return ".";

  const isAbsolute = path.charCodeAt(0) === CHAR_FORWARD_SLASH;
  const trailingSeparator =
    path.charCodeAt(path.length - 1) === CHAR_FORWARD_SLASH;

  // Normalize the path
  path = normalizeString(path, !isAbsolute, "/", isPosixPathSeparator);

  if (path.length === 0 && !isAbsolute) path = ".";
  if (path.length > 0 && trailingSeparator) path += "/";

  if (isAbsolute) return "/" + path;
  return path;
}

const CHAR_DOT: number = 46;
const CHAR_FORWARD_SLASH: number = 47;

function assertPath(path: string) {
  if (typeof path !== "string") {
    // NOTE(@wchargin): The exact error text used here has been changed
    // from the Node version to simplify the implementation.
    throw new TypeError("Path must be a string. Received " + String(path));
  }
}

function isPosixPathSeparator(code: number): boolean {
  return code === CHAR_FORWARD_SLASH;
}

// Resolves . and .. elements in a path with directory names
// NOTE(@wchargin): This function does not do exactly what the preceding
// comment (from the Node source) suggests. For instance, `/a/b` becomes
// `a/b`. Caveat lector.
// NOTE(@wchargin): PRECONDITION(A): `path` must not be empty.
// NOTE(@wchargin): PRECONDITION(B): `separator` must be "/" or "\\".
// NOTE(@wchargin): PRECONDITION(C): `isPathSeparator` must return
//   `true` given `separator.charCodeAt(0)`.
// NOTE(@wchargin): PRECONDITION(D): `isPathSeparator` must return
//   `true` given `CHAR_FORWARD_SLASH`.
function normalizeString(
  path: string,
  allowAboveRoot: boolean,
  separator: string,
  isPathSeparator: (code: number) => boolean
): string {
  // NOTE(@wchargin): INVARIANT(E): `res` does not end with `separator`.
  //   Proof: By induction, at initialization and at every assignment to
  //   `res`. The base case holds because `res` is empty and `separator`
  //   is not, by PRECONDITION(B). Assignments will be justified inline.
  // NOTE(@wchargin):  INVARIANT(F): `res` does not contain two
  //   consecutive separators. Proof: By induction, at initialization and
  //   at every assignment to `res`. The base case is immediate.
  //   Assignments will be justified inline.
  let res = "";
  let lastSegmentLength = 0;
  // NOTE(@wchargin): INVARIANT(G): `lastSlash` is always an integer,
  //   and `i` is always an integer. Proof: By induction. The initial
  //   values of each are integers. The only assignment to `i` is to
  //   increment it (`++i` in the loop declaration), which preserves
  //   integrality. The only reassignment to `lastSlash` is to assign it
  //   the value of `i`, which is known by induction to be an integer.
  // NOTE(@wchargin): INVARIANT(H): Once the loop index `i` is
  //   initialized, it holds that `lastSlash <= i`. Proof: By induction,
  //   at initialization of `i` and at every assignment to `i` or
  //   `lastSlash`. The base case is clear: `i` is initialized to `0`,
  //   at which point `lastSlash` is `-1`. The only assignment to `i` is
  //   `++i`, which preserves the invariant. The only assignments to
  //   `lastSlash` are to set its value to `i`, which also preserve the
  //   invariant.
  let lastSlash = -1;
  let dots = 0;
  let code: number;
  // NOTE(@wchargin): INVARIANT(I): Loop invariant:
  //   `path.slice(lastSlash + 1, i)` does not contain a `separator`
  //   (once `i` has been initialized). We refer to this expression as
  //   "the slice". Proof: By induction: at initialization of `i`, and
  //   at every assignment to `lastSlash`, `i`, or `path`. The base case
  //   is clear: initially, the slice has domain `(0, 0)`, so is empty.
  //   Assignments will be justified inline.
  // NOTE(@wchargin): LEMMA(J): If `lastSlash` is assigned the value `i`
  //   and neither `lastSlash` nor `i` nor `path` is modified before the
  //   next iteration of the loop, then INVARIANT(I) is preserved both
  //   (a) at the assignment and (b) at the iteration boundary. Proof:
  //   At the assignment, the slice has domain `(i + 1, i)`, so is
  //   empty. After `++i`, the slice has domain `(i + 1, i + 1)`, which
  //   is still empty. The empty string does not contain a `separator`,
  //   because `separator` is non-empty by PRECONDITION(B). This is
  //   sufficient to maintain the INVARIANT(I).
  // NOTE(@wchargin): INVARIANT(K): At the top of the loop,
  //   `lastSlash < i`. Proof: By cases on the iteration of the loop.
  //   For the first iteration of the loop, `lastSlash === -1` and
  //   `i === 0`. For subsequent iterations, note that INVARIANT(H) held
  //   at the bottom of the previous iteration of the loop, before `i`
  //   was incremented: that is, the previous value of `lastSlash` was
  //   less than or equal to the previous value of `i`. Since then,
  //   `lastSlash` has not been reassigned, and `i` has been
  //   incremented, so it follows that `lastSlash <= i - 1`, and
  //   therefore `lastSlash < i`.
  for (let i = 0; i <= path.length; ++i) {
    if (i < path.length) code = path.charCodeAt(i);
    // NOTE(@wchargin): The following cast is required because `code`
    //   could in principle be uninitialized. However, PRECONDITION(A)
    //   requires that the input be non-empty, which means that the
    //   above guard `if (i < path.length)` will at some point have
    //   taken the `true` branch, which means that `code` will have been
    //   assigned.
    // NOTE(@wchargin): The `then`-branch has been changed from `break;`
    //   to `return res;` to help Flow deduce that, after this block,
    //   `code` must be initialized. (The change is semantics-preserving
    //   because the statement after the loop is to `return res;`.)
    else if (isPathSeparator((code: any))) return res;
    else code = CHAR_FORWARD_SLASH;

    if (isPathSeparator(code)) {
      if (lastSlash === i - 1 || dots === 1) {
        // NOOP
      } else if (lastSlash !== i - 1 && dots === 2) {
        if (
          res.length < 2 ||
          lastSegmentLength !== 2 ||
          res.charCodeAt(res.length - 1) !== CHAR_DOT ||
          res.charCodeAt(res.length - 2) !== CHAR_DOT
        ) {
          if (res.length > 2) {
            const lastSlashIndex = res.lastIndexOf(separator);
            // NOTE(@wchargin): The `else`-branch of this `if`-statement
            //   is not reachable. See that branch for a proof. (The
            //   coverage pragma was added and is not present in the
            //   original Node source.)
            // istanbul ignore else
            if (lastSlashIndex !== res.length - 1) {
              if (lastSlashIndex === -1) {
                // NOTE(@wchargin): JUSTIFICATION: This assignment
                //   trivially preserves INVARIANT(E) and INVARIANT(F).
                res = "";
                lastSegmentLength = 0;
              } else {
                // NOTE(@wchargin): JUSTIFICATION: This assignment
                // preserves INVARIANT(E):
                //     - By control flow, we know that
                //       `lastSlashIndex !== -1`.
                //     - By definition of `lastIndexOf`, this means that
                //       `res` contains a `separator` at index
                //       `lastSlashIndex`.
                //     - By INVARIANT(F), `res` does not contain two
                //       consecutive `separator`s. Therefore, `res` does
                //       not contain a `separator` at index
                //       `lastSlashIndex - 1`.
                //     - Therefore, the new value for `res` does not
                //       contain a `separator` at `lastSlashIndex - 1`,
                //       so it does not end with a `separator`.
                // NOTE(@wchargin): JUSTIFICATION: This assignment
                //   preserves INVARIANT(F). By INVARIANT(F), we know
                //   inductively that `res` does not contain two
                //   consecutive `separator`s. It is immediate that no
                //   slice of `res` contains two consecutive
                //   `separator`s.
                res = res.slice(0, lastSlashIndex);
                lastSegmentLength = res.length - 1 - res.lastIndexOf(separator);
              }
              // NOTE(@wchargin): JUSTIFICATION: This assignment
              //   preserves INVARIANT(I) by LEMMA(J).
              lastSlash = i;
              dots = 0;
              // NOTE(@wchargin): JUSTIFICATION: This loop boundary
              //   preserves INVARIANT(I) by LEMMA(J).
              continue;
            } else {
              // NOTE(@wchargin): This `else`-branch was added by
              //   @wchargin; it is not present in the original Node
              //   source. It is unreachable. Proof: INVARIANT(E)
              //   indicates that `res` does not end in a `separator`,
              //   which means that `lastSlashIndex !== res.length - 1`,
              //   which is the guard for the enclosing `if`-statement.
              throw new Error(
                "normalize: invariant violation: " +
                  JSON.stringify({path, allowAboveRoot, separator})
              );
            }
          } else if (res.length === 2 || res.length === 1) {
            // NOTE(@wchargin): JUSTIFICATION: This assignment trivially
            //   preserves INVARIANT(E) and INVARIANT(F).
            res = "";
            lastSegmentLength = 0;
            // NOTE(@wchargin): JUSTIFICATION: This assignment preserves
            //   INVARIANT(I) by LEMMA(J).
            lastSlash = i;
            dots = 0;
            // NOTE(@wchargin): JUSTIFICATION: This loop boundary
            //   preserves INVARIANT(I) by LEMMA(J).
            continue;
          }
        }
        if (allowAboveRoot) {
          // NOTE(@wchargin): JUSTIFICATION: This assignment preserves
          //   INVARIANT(E) because `separator` is either "/" or "\\" by
          //   PRECONDITION(B), and so the new value of `res`, which
          //   ends with ".", does not end with `separator`.
          // NOTE(@wchargin): JUSTIFICATION: This assignment preserves
          //   INVARIANT(F). We know by INVARIANT(E) that `res` does not
          //   end with a separator. Therefore, appending a `separator`
          //   does not introduce two consecutive `separator`s, and
          //   appending two copies of "." does not introduce two
          //   consecutive separators because, by PRECONDITION(B),
          //   `separator` is either "/" or "\\" and so does not contain
          //   ".".
          if (res.length > 0) res += `${separator}..`;
          // NOTE(@wchargin): JUSTIFICATION: This assignment preserves
          //   INVARIANT(E) and INVARIANT(F) because `separator` is
          //   either "/" or "\\" by PRECONDITION(B), and so does not
          //   appear in the new value for `res` at all (either at the
          //   end or twice consecutively).
          else res = "..";
          lastSegmentLength = 2;
        }
      } else {
        // NOTE(@wchargin): JUSTIFICATION: This assignment preserves
        // INVARIANT(D) and INVARIANT(E):
        //   - By INVARIANT(K), `lastSlash` was less than `i` at the top
        //     of the loop body. By control flow, neither `lastSlash`
        //     nor `i` has since been reassigned, so it still holds that
        //     `lastSlash < i`.
        //   - At this point in the loop body, we have not assigned to
        //     `lastSlash`.
        //   - By control flow, we also have `lastSlash !== i - 1`.
        //   - By INVARIANT(G), both `lastSlash` and `i` are integers.
        //   - Therefore, `lastSlash < i - 1`, so `lastSlash + 1 < i`.
        //     This indicates that the domain of the slice is nonempty;
        //     we still must show that it is within the bounds of the
        //     string being sliced.
        //   - By the loop guard, `i <= path.length`.
        //   - Therefore, `lastSlash + 1 < path.length`.
        //   - Therefore, `path.slice(lastSlash + 1, i)` is nonempty.
        //   - By INVARIANT(I), this slice does not contain a
        //     `separator`.
        //   - Because the slice is nonempty, the new value of `res`
        //     will end in the last character of the slice, which is not a
        //     `separator`, so INVARIANT(E) is preserved.
        //   - Because `res` does not end with a separator, appending a
        //     separator to `res` does not introduce two consecutive
        //     separators. Because the slice does not contain a
        //     separator, subsequently appending the slice also does not
        //     introduce two consecutive separators, so INVARIANT(F) is
        //     preserved.
        if (res.length > 0) res += separator + path.slice(lastSlash + 1, i);
        // NOTE(@wchargin): JUSTIFICATION: This assignment preserves
        //   INVARIANT(E) and INVARIANT(F), because we know from
        //   INVARIANT(I) that the slice does not contain a separator at
        //   all, so the new value of `res` neither ends in a separator
        //   nor contains two consecutive separators.
        else res = path.slice(lastSlash + 1, i);
        lastSegmentLength = i - lastSlash - 1;
      }
      // NOTE(@wchargin): JUSTIFICATION: This assignment preserves
      //   INVARIANT(I) by LEMMA(J).
      lastSlash = i;
      dots = 0;
      // NOTE(@wchargin): JUSTIFICATION: This loop boundary preserves
      //   INVARIANT(I) by LEMMA(J).
    } else if (code === CHAR_DOT && dots !== -1) {
      ++dots;
      // NOTE(@wchargin): JUSTIFICATION: This loop boundary preserves
      //   INVARIANT(I). We know by that `path.slice(lastSlash + 1, i)`
      //   does not contain a separator, by induction. We know from
      //   control flow that `code` is `CHAR_DOT`, so `path[i]` is not a
      //   separator. Thus, `path.slice(lastSlash + 1, i + 1)` does not
      //   contain a separator, so INVARIANT(I) holds.
    } else {
      dots = -1;
      // NOTE(@wchargin): JUSTIFICATION: This loop boundary preserves
      // INVARIANT(I):
      //   - We know that `path.slice(lastSlash + 1, i)` does not
      //     contain a separator, by induction.
      //   - We know from control flow that `!isPathSeparator(code)`.
      //   - We also know from control flow that `code` is either
      //     `path.charCodeAt(i)` or `CHAR_FORWARD_SLASH`.
      //   - PRECONDITION(D) shows that `code` cannot be
      //     `CHAR_FORWARD_SLASH`, because `!isPathSeparator(code)`, so
      //     `code` must be `path.charCodeAt(i)`.
      //   - PRECONDITION(C) shows that `code` cannot be
      //     `separator.charCodeAt(0)`.
      //   - This implies that `path[i]` is not `separator`.
      //   - Thus, `path.slice(lastSlash + 1, i + 1)` does not contain a
      //     separator, so INVARIANT(I) holds.
    }
  }
  return res;
}
