// @flow

import Database from "better-sqlite3";
import path from "path";
import {RelationalView} from "./relationalView";
import {
  GithubReferenceDetector,
  fromRelationalView,
  referenceMapFromDB,
} from "./referenceDetector";
import {MappedReferenceDetector} from "../../core/references";
import {exampleRelationalView} from "./example/example";
import {NodeAddress} from "../../core/graph";

function mapValues<A, B, C>(map: Map<A, B>, fn: (B) => C): Map<A, C> {
  const newMap = new Map();
  for (const [k, v] of map.entries()) {
    newMap.set(k, fn(v));
  }
  return newMap;
}

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

  describe("fromRelationalView", () => {
    it("should use urlReferenceMap to create the instance", () => {
      // Given
      const rv = new RelationalView();
      const urlReferenceMap = jest.spyOn(rv, "urlReferenceMap");

      // When
      const refs = fromRelationalView(rv);

      // Then
      expect(refs).toBeInstanceOf(MappedReferenceDetector);
      expect(urlReferenceMap).toBeCalledTimes(1);
    });
  });

  describe("referenceMapFromDB", () => {
    it("should work with an example DB, compared to the example RelationalView", () => {
      // Given
      const owner = "sourcecred-test";
      const db = new Database(
        path.join(__dirname, "example", "example-mirror.db")
      );
      const rv = exampleRelationalView();

      // When
      const refs = referenceMapFromDB(db, owner);

      // Then
      const rvRefs = rv.urlReferenceMap();
      expect(refs).toEqual(rvRefs);
      const noNullRefs = mapValues(refs, NodeAddress.toParts);
      expect(noNullRefs).toMatchSnapshot();
    });
  });
});
