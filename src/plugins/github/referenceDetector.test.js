// @flow

import {RelationalView} from "./relationalView";
import {GithubReferenceDetector, fromRelationalView} from "./referenceDetector";
import {MappedReferenceDetector} from "../../core/references";

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
});
