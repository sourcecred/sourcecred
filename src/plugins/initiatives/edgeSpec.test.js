// @flow

import {type TimestampMs} from "../../util/timestamp";
import {type NodeEntry} from "./nodeEntry";
import {
  type EdgeSpec,
  type EdgeSpecJson,
  normalizeEdgeSpec,
  _validateEdgeSpec,
  _findDuplicatesByKey,
} from "./edgeSpec";

const exampleEntry = (overrides: $Shape<NodeEntry>): NodeEntry => ({
  key: "sample-title",
  title: "Sample title",
  timestampMs: 123,
  contributors: [],
  weight: 456,
  ...overrides,
});

describe("plugins/initiatives/edgeSpec", () => {
  describe("normalizeEdgeSpec", () => {
    it("should add empty arrays when missing", () => {
      const timestampMs: TimestampMs = 321;
      const json: EdgeSpecJson = {};

      const actual = normalizeEdgeSpec(json, timestampMs);
      expect(actual).toEqual({urls: [], entries: []});
    });

    it("should preserve urls when present", () => {
      const timestampMs: TimestampMs = 321;
      const json: EdgeSpecJson = {
        urls: ["https://foo.bar/a", "https://foo.bar/b"],
      };

      const actual = normalizeEdgeSpec(json, timestampMs);
      expect(actual).toEqual({urls: json.urls, entries: []});
    });

    it("should normalize any entries from json format", () => {
      const timestampMs: TimestampMs = 321;
      const json: EdgeSpecJson = {
        entries: [{title: "Minimal example"}],
      };

      const actual = normalizeEdgeSpec(json, timestampMs);
      expect(actual).toEqual({
        urls: [],
        entries: [
          {
            key: "minimal-example",
            title: "Minimal example",
            timestampMs,
            contributors: [],
            weight: null,
          },
        ],
      });
    });

    it("should throw on entries with the same key", () => {
      const timestampMs: TimestampMs = 321;
      const json: EdgeSpecJson = {
        entries: [
          {key: "1", title: "first"},
          {key: "1", title: "also first"},
          {key: "3", title: "third"},
        ],
      };

      const f = () => normalizeEdgeSpec(json, timestampMs);
      expect(f).toThrow(
        "Duplicate entry keys are not allowed, you may need to " +
          "set keys manually for:"
      );
    });
  });

  describe("_validateEdgeSpec", () => {
    it("should throw on entries with the same key", () => {
      const edgeSpec: EdgeSpec = {
        urls: [],
        entries: [
          exampleEntry({key: "1", title: "first"}),
          exampleEntry({key: "1", title: "also first"}),
          exampleEntry({key: "3", title: "third"}),
        ],
      };

      const f = () => _validateEdgeSpec(edgeSpec);
      expect(f).toThrow(
        "Duplicate entry keys are not allowed, you may need to " +
          "set keys manually for:"
      );
    });
  });

  describe("_findDuplicatesByKey", () => {
    it("should detect entries with the same key", () => {
      const entries: NodeEntry[] = [
        exampleEntry({key: "1", title: "first"}),
        exampleEntry({key: "1", title: "also first"}),
        exampleEntry({key: "3", title: "third"}),
      ];

      const actual = _findDuplicatesByKey(entries);

      const expected = new Set([entries[0], entries[1]]);
      expect(actual).toEqual(expected);
    });
  });
});
