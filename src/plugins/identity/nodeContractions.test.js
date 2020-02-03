// @flow

import {nodeContractions, _contraction} from "./nodeContractions";
import {resolveAlias} from "./alias";
import {identityNode} from "./identity";

describe("src/plugins/identity/nodeContractions", () => {
  describe("_contraction", () => {
    it("processes an empty identity", () => {
      const identity = {username: "empty", aliases: []};
      const actual = _contraction(identity, null);
      const expected = {old: [], replacement: identityNode(identity)};
      expect(actual).toEqual(expected);
    });
    it("processes a single-alias identity", () => {
      const alias = "github/foo";
      const identity = {username: "foo", aliases: [alias]};
      const actual = _contraction(identity, null);
      const expected = {
        old: [resolveAlias(alias, null)],
        replacement: identityNode(identity),
      };
      expect(actual).toEqual(expected);
    });
    it("processes a multi-alias identity", () => {
      const aliases = ["github/foo", "discourse/bar"];
      const identity = {username: "foo", aliases};
      const url = "https://example.com";
      const actual = _contraction(identity, url);
      const expected = {
        old: aliases.map((x) => resolveAlias(x, url)),
        replacement: identityNode(identity),
      };
      expect(actual).toEqual(expected);
    });
  });

  describe("nodeContractions", () => {
    it("errors if any username is duplicated", () => {
      const identities = [
        {username: "foo", aliases: ["github/foo", "github/bar"]},
        {username: "foo", aliases: []},
      ];
      expect(() =>
        nodeContractions({identities, discourseServerUrl: null})
      ).toThrowError("Duplicate username");
    });
    it("errors if any alias is duplicated", () => {
      const identities = [
        {username: "foo", aliases: ["github/foo", "github/bar"]},
        {username: "bar", aliases: ["github/foo"]},
      ];
      expect(() =>
        nodeContractions({identities, discourseServerUrl: null})
      ).toThrowError("Duplicate alias");
    });
    it("produces a contraction for each identity", () => {
      const identities = [
        {username: "foo", aliases: ["discourse/foo"]},
        {username: "bar", aliases: ["github/bar"]},
      ];
      const spec = {identities, discourseServerUrl: "https://example.com"};
      expect(nodeContractions(spec)).toEqual(
        identities.map((i) => _contraction(i, spec.discourseServerUrl))
      );
    });
  });
});
