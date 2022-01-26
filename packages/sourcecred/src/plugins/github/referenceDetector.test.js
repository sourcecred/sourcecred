// @flow

import {exampleRelationalView, exampleRepository} from "./example/example";
import {RelationalView} from "./relationalView";
import {
  GithubReferenceDetector,
  fromRelationalViews,
} from "./referenceDetector";
import {MappedReferenceDetector} from "../../core/references";
import {NodeAddress} from "../../core/graph";
import dedent from "../../util/dedent";

describe("plugins/github/referenceDetector", () => {
  describe("GithubReferenceDetector", () => {
    it("should be a MappedReferenceDetector", () => {
      // Given
      const map = new Map();

      // When
      const refs = new GithubReferenceDetector(map);

      // Then
      expect(refs).toBeInstanceOf(MappedReferenceDetector);
    });
  });

  describe("fromRelationalViews", () => {
    it("should use urlReferenceMap to create the instance", () => {
      // Given
      const rv = RelationalView.FromGraphQL(new exampleRepository());
      const urlReferenceMap = jest.spyOn(rv, "urlReferenceMap");

      // When
      const refs = fromRelationalViews([rv, rv]);

      // Then
      expect(refs).toBeInstanceOf(MappedReferenceDetector);
      expect(urlReferenceMap).toBeCalledTimes(2);
    });

    it("should deduplicate silently given the same entries", () => {
      // Given
      const rv = exampleRelationalView();

      // When
      const refs = fromRelationalViews([rv, rv]);

      // Then
      expect(refs.map).toEqual(rv.urlReferenceMap());
    });

    it("should throw when encountering duplicate keys with different values", () => {
      // Given
      const url = "http://foo.bar";
      const nodeA = NodeAddress.fromParts(["test", "A"]);
      const nodeB = NodeAddress.fromParts(["test", "B"]);
      const rv1 = RelationalView.FromGraphQL(new exampleRepository());
      const rv2 = RelationalView.FromGraphQL(new exampleRepository());
      const rv1Spy = jest.spyOn(rv1, "urlReferenceMap");
      const rv2Spy = jest.spyOn(rv2, "urlReferenceMap");
      rv1Spy.mockReturnValue(new Map([[url, nodeA]]));
      rv2Spy.mockReturnValue(new Map([[url, nodeB]]));

      // When
      const fn = () => fromRelationalViews([rv1, rv2]);

      // Then
      expect(fn).toThrow(dedent`\
        An entry for http://foo.bar already existed, but with a different NodeAddressT.
        This is probably a bug with SourceCred. Please report it on GitHub.
        Old: NodeAddress["test","A"]
        New: NodeAddress["test","B"]`);
    });
  });
});
