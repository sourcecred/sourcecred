// @flow

import {NodeAddress} from "../core/graph";
import {resolveAlias, toAlias} from "./alias";
import {loginAddress as githubAddress} from "../plugins/github/nodes";
import {userAddress as discourseAddress} from "../plugins/discourse/address";

describe("src/cli/alias", () => {
  describe("resolveAlias", () => {
    describe("errors on", () => {
      it("an empty alias", () => {
        expect(() => resolveAlias("", null)).toThrow("Unable to parse");
      });
      it("an alias without a /-delimited prefix", () => {
        expect(() => resolveAlias("@credbot", null)).toThrow("Unable to parse");
      });
      it("an alias not anchored to start of string", () => {
        expect(() => resolveAlias("my github/@credbot", null)).toThrow(
          "Unable to parse"
        );
      });
      it("an alias not anchored to end of string", () => {
        expect(() => resolveAlias("github/@credbot friend", null)).toThrow(
          "Invalid GitHub username"
        );
      });
      it("an alias with an unknown prefix", () => {
        expect(() => resolveAlias("foo/bar", null)).toThrow(
          "Unknown type for alias"
        );
      });
      it("a discourse alias without a url", () => {
        expect(() => resolveAlias("discourse/foo", null)).toThrow(
          "without Discourse url"
        );
      });
      it("a github login with invalid characters", () => {
        expect(() => resolveAlias("github/!@#$", null)).toThrow(
          "Invalid GitHub username"
        );
      });
      it("a github login with underscores", () => {
        expect(() => resolveAlias("github/foo_bar", null)).toThrow(
          "Invalid GitHub username"
        );
      });
      it("a discourse login with invalid characters", () => {
        expect(() => resolveAlias("discourse/!@#$", "url")).toThrow(
          "Invalid Discourse username"
        );
      });
    });
    describe("works on", () => {
      it("a github login", () => {
        const actual = resolveAlias("github/login", null);
        const expected = githubAddress("login");
        expect(actual).toEqual(expected);
      });
      it("a github login with hyphens", () => {
        const actual = resolveAlias("github/login-foo-bar", null);
        const expected = githubAddress("login-foo-bar");
        expect(actual).toEqual(expected);
      });
      it("a discourse login", () => {
        const url = "https://example.com";
        const actual = resolveAlias("discourse/login", url);
        const expected = discourseAddress(url, "login");
        expect(actual).toEqual(expected);
      });
      it("a github login with prefixed @", () => {
        const a = resolveAlias("github/login", null);
        const b = resolveAlias("github/@login", null);
        expect(a).toEqual(b);
      });
      it("a discourse login with prefixed @", () => {
        const url = "https://example.com";
        const a = resolveAlias("discourse/login", url);
        const b = resolveAlias("discourse/@login", url);
        expect(a).toEqual(b);
      });
    });
  });
  describe("toAlias", () => {
    function checkRoundTrip(alias) {
      const addr = resolveAlias(alias, "https://example.com");
      expect(toAlias(addr)).toEqual(alias);
    }
    it("works for a GitHub node address", () => {
      checkRoundTrip("github/example");
    });
    it("works for a Discourse node address", () => {
      checkRoundTrip("discourse/example");
    });
    it("returns null for an address without an aliasing scheme", () => {
      const address = NodeAddress.fromParts(["sourcecred", "plugin", "foo"]);
      expect(toAlias(address)).toEqual(null);
    });
  });
});
