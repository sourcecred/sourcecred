// @flow

import {resolveAlias} from "./alias";
import {loginAddress as githubAddress} from "../github/nodes";
import {userAddress as discourseAddress} from "../discourse/address";

describe("src/plugins/identity/alias", () => {
  describe("resolveAlias", () => {
    describe("errors on", () => {
      it("an empty alias", () => {
        expect(() => resolveAlias("", null)).toThrow("Unable to parse");
      });
      it("an alias without a /-delimited prefix", () => {
        expect(() => resolveAlias("@credbot", null)).toThrow("Unable to parse");
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
    });
    describe("works on", () => {
      it("a github login", () => {
        const actual = resolveAlias("github/login", null);
        const expected = githubAddress("login");
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
});
