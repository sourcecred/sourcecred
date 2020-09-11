// @flow

import path from "path";

import normalize from "./pathNormalize";

describe("util/pathNormalize", () => {
  describe("normalize", () => {
    it("throws an error on non-string input", () => {
      for (const bad of [
        null,
        undefined,
        17,
        {wat: "wat"},
        ["wat"],
        Symbol("wat"),
      ]) {
        // $FlowExpectedError[incompatible-call]
        expect(() => normalize(bad)).toThrow(
          "Path must be a string. Received " + String(bad)
        );
      }
    });

    function test(input: string, expectedOutput: string): void {
      const oracleOutput: string = path.posix.normalize(input);
      if (oracleOutput !== expectedOutput) {
        // This might actually happen. There have been bug fixes to the
        // behavior of Node's `normalize` since Node v8, which is the
        // stable version for SourceCred. These would show up as
        // "failures" because we have backported the logic from Node
        // v10.8.0, which was last changed in v10.0.0, and is correct in
        // cases where the host Node may not be.
        let nodeRecentEnough = false;
        const nodeVersion = /^v(\d+)\.(\d+)\.(\d+)$/.exec(process.version);
        if (nodeVersion) {
          const minimum = [10, 0, 0];
          const actual = [+nodeVersion[1], +nodeVersion[2], +nodeVersion[3]];
          const delta = [0, 1, 2].reduce(
            (acc, i) => (acc !== 0 ? acc : actual[i] - minimum[i]),
            0
          );
          if (delta >= 0) {
            nodeRecentEnough = true;
          }
        }
        if (nodeRecentEnough) {
          throw new Error(
            "bad expected output: " +
              JSON.stringify({input, expectedOutput, oracleOutput})
          );
        } else {
          // Your Node is probably wrong. Ignore the oracle failure.
        }
      }
      expect(normalize(input)).toEqual(expectedOutput);
    }

    // The contents of test cases are copied directly from the Node
    // tests in `test/parallel/test-path-normalize.js` at Git commit
    // e0395247c899af101f8a1f76a8554be1ff14040a. The code being copied
    // is published under the MIT License.
    it("passes the tests in Node core", () => {
      test("./fixtures///b/../b/c.js", "fixtures/b/c.js");
      test("/foo/../../../bar", "/bar");
      test("a//b//../b", "a/b");
      test("a//b//./c", "a/b/c");
      test("a//b//.", "a/b");
      test("/a/b/c/../../../x/y/z", "/x/y/z");
      test("///..//./foo/.//bar", "/foo/bar");
      test("bar/foo../../", "bar/");
      test("bar/foo../..", "bar");
      test("bar/foo../../baz", "bar/baz");
      test("bar/foo../", "bar/foo../");
      test("bar/foo..", "bar/foo..");
      test("../foo../../../bar", "../../bar");
      test("../.../.././.../../../bar", "../../bar");
      test("../../../foo/../../../bar", "../../../../../bar");
      test("../../../foo/../../../bar/../../", "../../../../../../");
      test("../foobar/barfoo/foo/../../../bar/../../", "../../");
      test("../.../../foobar/../../../bar/../../baz", "../../../../baz");
      test("foo/bar\\baz", "foo/bar\\baz");
    });
    //
    // The remaining tests are for cases not covered by Node's tests.
    it("handles the empty input", () => {
      test("", ".");
    });
    it("handles a relative path that is empty after ..-elision", () => {
      test("a/..", ".");
    });
  });
});
