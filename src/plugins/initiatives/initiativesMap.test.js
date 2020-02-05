// @flow

import stringify from "json-stable-stringify";
import {NodeAddress} from "../../core/graph";
import {
  mapToInitiatives,
  initiativesToMap,
  fromJSON,
  toJSON,
  _trackerAddress,
  _keySlug,
  _initiativeToEntry,
} from "./initiativesMap";

describe("plugins/initiatives/initiativesMap", () => {
  const exampleJSON = require("./example/initiatives.json");
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
  const exampleInitiative = {
    title: "Sample initiative",
    timestampMs: 1578520917766,
    tracker: NodeAddress.fromParts([
      "sourcecred",
      "initiativesMap",
      "2020-01-08_sample-initiative",
    ]),
    completed: false,
    champions: [],
    contributions: [],
    dependencies: [],
    references: [],
  };

  describe("_keySlug", () => {
    it("should construct the correct key", () => {
      // Given

      // When
      const key = _keySlug(exampleInitiative);

      // Then
      expect(key).toEqual("2020-01-08_sample-initiative");
    });

    it("should only produce infix dashes, without duplicates", () => {
      // Given
      const initiative = {
        ...exampleInitiative,
        title: "# Foo - & - Bar ?",
      };

      // When
      const key = _keySlug(initiative);

      // Then
      expect(key).toEqual("2020-01-08_foo-bar");
    });
  });

  describe("_initiativeToEntry", () => {
    it("should construct the correct entry", () => {
      // Given

      // When
      const [key, entry] = _initiativeToEntry(exampleInitiative);

      // Then
      expect(key).toEqual("2020-01-08_sample-initiative");
      expect(entry).toEqual({
        title: "Sample initiative",
        timestampMs: 1578520917766,
        completed: false,
        champions: [],
        contributions: [],
        dependencies: [],
        references: [],
      });
    });
  });

  describe("_trackerAddress", () => {
    it("should construct the correct NodeAddress", () => {
      // Given
      const key = "hello-test";

      // When
      const trackerAddress = _trackerAddress(key);

      // Then
      expect(trackerAddress).toEqual(
        NodeAddress.fromParts(["sourcecred", "initiativesMap", key])
      );
    });
  });

  describe("mapToInitiatives", () => {
    it("should handle an example map", () => {
      // Given

      // When
      const initiatives = mapToInitiatives(exampleMap);

      // Then
      expect(initiatives).toEqual([exampleInitiative]);
    });
  });

  describe("initiativesToMap", () => {
    it("should handle an example initiative", () => {
      // Given

      // When
      const actual = initiativesToMap([exampleInitiative]);

      // Then
      expect(actual).toEqual(exampleMap);
    });

    it("should handle conflicting keys by incrementing a suffix", () => {
      // Given
      const initiatives = Array(4).fill(exampleInitiative);

      // When
      const actual = initiativesToMap(initiatives);

      // Then
      expect(Object.keys(actual)).toEqual([
        "2020-01-08_sample-initiative",
        "2020-01-08_sample-initiative-2",
        "2020-01-08_sample-initiative-3",
        "2020-01-08_sample-initiative-4",
      ]);
    });

    it("throws at 100+ conflicting keys", () => {
      // Given
      const initiatives = Array(101).fill(exampleInitiative);

      // When
      const fn = () => initiativesToMap(initiatives);

      // Then
      expect(fn).toThrow(
        "Couldn't generate an appropriate key in 100 attempts " +
          'for initiative "Sample initiative" (2020-01-08)'
      );
    });
  });

  describe("toJSON/fromJSON", () => {
    it("should handle an example map round-trip", () => {
      // Given

      // When
      const actual = fromJSON(toJSON(exampleMap));

      // Then
      expect(actual).toEqual(exampleMap);
    });
  });

  describe("smoke test", () => {
    it("should handle a full round-trip", () => {
      // Given

      // When
      const initiatives = mapToInitiatives(fromJSON(exampleJSON));
      const json = toJSON(initiativesToMap(initiatives));

      // Then
      // Note: stringify avoids binary snapshots.
      expect(stringify(initiatives, {space: 2})).toMatchSnapshot();
      expect(json).toMatchSnapshot();
    });

    it("should normalize the keys through a round-trip", () => {
      // Given

      // When
      const round0 = fromJSON(exampleJSON);
      const round1 = initiativesToMap(mapToInitiatives(round0));
      const round2 = initiativesToMap(mapToInitiatives(round1));

      // Then
      expect(Object.keys(round1)).not.toEqual(Object.keys(round0));
      expect(Object.keys(round2)).toEqual(Object.keys(round1));
    });
  });
});
