// @flow

import {fromJSON, toJSON} from "./initiativesMap";

describe("plugins/initiatives/initiativesMap", () => {
  const exampleMap = {
    "2020-01-08_sample-initiative": {
      title: "Sample initiative",
      timestampMs: 1578520917766,
      completed: false,
      champions: [],
      contributions: [],
      dependencies: [],
      references: [],
    },
  };

  describe("toJSON/fromJSON", () => {
    it("should handle an example map round-trip", () => {
      // Given

      // When
      const actual = fromJSON(toJSON(exampleMap));

      // Then
      expect(actual).toEqual(exampleMap);
    });
  });
});
