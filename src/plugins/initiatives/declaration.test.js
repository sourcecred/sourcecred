// @flow

import {_formatNodeEntryField} from "./declaration";

describe("plugins/initiatives/declaration", () => {
  describe("_formatNodeEntryField", () => {
    it("should work given the various fields", () => {
      expect(_formatNodeEntryField("CONTRIBUTION")).toEqual("Contribution");
      expect(_formatNodeEntryField("DEPENDENCY")).toEqual("Dependency");
      expect(_formatNodeEntryField("REFERENCE")).toEqual("Reference");
    });
  });
});
