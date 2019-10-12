// @flow

import {
  type Environment,
  type VersionInfo,
  formatFull,
  formatShort,
  parseEnvironment,
  parseGitState,
} from "./version";

describe("core/version", () => {
  const version = (): VersionInfo => ({
    major: 3,
    minor: 13,
    patch: 37,
    gitState: {
      commitHash: "d0e1a2d3b4e5",
      commitTimestamp: "20010203-0405",
      dirty: true,
    },
    environment: "test",
  });

  describe("parseGitState", () => {
    it("fails given literal `undefined`", () => {
      expect(() => parseGitState(undefined)).toThrow(
        "gitState: not a string: undefined"
      );
    });
    it("fails given literal `null`", () => {
      expect(() => parseGitState(null)).toThrow("gitState: not a string: null");
    });
    it("fails given JSON `null`", () => {
      expect(() => parseGitState("null")).toThrow(
        "gitState: not a JSON object: null"
      );
    });
    it("fails given invalid JSON", () => {
      expect(() => parseGitState("wat")).toThrow(
        "Unexpected token w in JSON at position 0"
      );
    });
    it("fails given a JSON string", () => {
      expect(() => parseGitState(JSON.stringify("wat"))).toThrow(
        "gitState: not a JSON object: wat"
      );
    });
    it("fails given a non-stringified `GitState`", () => {
      // $ExpectFlowError
      expect(() => parseGitState(version().gitState)).toThrow(
        "gitState: not a string: [object Object]"
      );
    });
    it("fails given a JSON object missing a property", () => {
      const gitState = version().gitState;
      // $ExpectFlowError
      delete gitState.dirty;
      expect(() => parseGitState(JSON.stringify(gitState))).toThrow(
        "gitState: bad shape: {"
      );
    });
    function expectBadShape(gitState) {
      expect(() => parseGitState(JSON.stringify(gitState))).toThrow(
        "gitState: bad shape: {"
      );
    }
    it("fails given a JSON object with an extra property", () => {
      expectBadShape({...version().gitState, wat: "wot"});
    });
    it("fails given a JSON object with bad `commitHash`", () => {
      expectBadShape({...version().gitState, commitHash: true});
      expectBadShape({...version().gitState, commitHash: 27});
      expectBadShape({...version().gitState, commitHash: null});
    });
    it("fails given a JSON object with bad `commitTimestamp`", () => {
      expectBadShape({...version().gitState, commitTimestamp: true});
      expectBadShape({...version().gitState, commitTimestamp: 27});
      expectBadShape({...version().gitState, commitTimestamp: null});
    });
    it("fails given a JSON object with bad `dirty`", () => {
      expectBadShape({...version().gitState, dirty: "true"});
      expectBadShape({...version().gitState, dirty: 27});
      expectBadShape({...version().gitState, dirty: null});
    });
    it("parses a valid `GitState`", () => {
      const gitState = version().gitState;
      expect(parseGitState(JSON.stringify(gitState))).toEqual(gitState);
    });
  });

  describe("parseEnvironment", () => {
    it("parses each of the valid environments", () => {
      const allEnvs = {development: true, production: true, test: true};
      function _unused_staticCheck(x: Environment): true {
        return allEnvs[x];
      }
      for (const env of Object.keys(allEnvs)) {
        expect(parseEnvironment(env)).toEqual(env);
      }
    });

    it("fails given literal `undefined`", () => {
      expect(() => parseEnvironment(undefined)).toThrow(
        "environment: undefined"
      );
    });
    it("fails given literal `null`", () => {
      expect(() => parseEnvironment(null)).toThrow("environment: null");
    });
    it("fails given a non-environment string", () => {
      expect(() => parseEnvironment("wat")).toThrow('environment: "wat"');
    });
  });

  describe("formatShort", () => {
    it("includes the major, minor, and patch versions", () => {
      expect(formatShort(version())).toContain("3.13.37");
    });
    it("does not include the Git hash", () => {
      expect(formatShort(version())).not.toContain("d0e1");
    });
    it("does not include the Node environment", () => {
      expect(formatShort(version())).not.toContain("-test");
    });
  });

  describe("formatFull", () => {
    it("includes the major, minor, and patch versions", () => {
      expect(formatFull(version())).toContain("3.13.37");
    });
    it("includes the Git hash and timestamp", () => {
      expect(formatFull(version())).toContain("d0e1a2d3b4e5-20010203-0405");
    });
    it("includes the dirty state", () => {
      expect(formatFull(version())).toContain("-dirty");
    });
    it("includes the Node environment", () => {
      expect(formatFull(version())).toContain("-test");
    });
  });
});
