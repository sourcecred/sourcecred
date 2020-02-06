// @flow

import {type InitiativeFile, fromJSON, toJSON} from "./initiativesDirectory";

const exampleInitiativeFile = (): InitiativeFile => ({
  title: "Sample initiative",
  timestampIso: ("2020-01-08T22:01:57.766Z": any),
  completed: false,
  champions: ["http://foo.bar/champ"],
  contributions: ["http://foo.bar/contrib"],
  dependencies: ["http://foo.bar/dep"],
  references: ["http://foo.bar/ref"],
});

describe("plugins/initiatives/initiativesDirectory", () => {
  describe("toJSON/fromJSON", () => {
    it("should handle an example round-trip", () => {
      // Given
      const initiativeFile = exampleInitiativeFile();

      // When
      const actual = fromJSON(toJSON(initiativeFile));

      // Then
      expect(actual).toEqual(initiativeFile);
    });
  });
});
