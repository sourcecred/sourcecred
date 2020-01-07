// @flow

import {fromTrackerTranslation} from "./referenceDetector";
import {type InitiativeRepository, type Initiative} from "./initiative";
import {type NodeAddressT, NodeAddress} from "../../core/graph";
import {MappedReferenceDetector} from "../../core/references";

const maybeToParts = (a: ?NodeAddressT) => {
  return a ? NodeAddress.toParts(a) : a;
};

class MockInitiativeRepository implements InitiativeRepository {
  _initiatives: Initiative[];

  constructor() {
    this._initiatives = [];
  }

  addInitiative(title: string, tracker: NodeAddressT) {
    this._initiatives.push({
      title,
      tracker,
      timestampMs: 1234,
      completed: false,
      dependencies: [],
      references: [],
      contributions: [],
      champions: [],
    });
  }

  initiatives(): $ReadOnlyArray<Initiative> {
    return [...this._initiatives];
  }
}

describe("plugins/initiatives/referenceDetector", () => {
  describe("fromTrackerTranslation", () => {
    // This is a smoke test, as the underlying TranslatingReferenceDetector
    // is extensively tested. We're mostly interested in testing whether
    // it correctly maps based on the InitiativeRepository data.
    it("should correctly translate a tracker address to initiative address", () => {
      // Given
      const nodeA = NodeAddress.fromParts(["TRACKER", "A"]);
      const url = "http://foo.bar";

      const base = new MappedReferenceDetector(new Map());
      base.map.set(url, nodeA);

      const repo = new MockInitiativeRepository();
      repo.addInitiative("Make tests work", nodeA);

      // When
      const detector = fromTrackerTranslation(base, repo);
      const result = detector.addressFromUrl(url);

      // Then
      expect(maybeToParts(result)).toMatchInlineSnapshot(`
        Array [
          "sourcecred",
          "initiatives",
          "initiative",
          "TRACKER",
          "A",
        ]
      `);
    });
  });
});
