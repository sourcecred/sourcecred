// @flow

import {NodeAddress} from "../../core/graph";
import {filterTimelineCred} from "./filterTimelineCred";

describe("src/analysis/timeline/filterTimelineCred", () => {
  const na = (...parts) => NodeAddress.fromParts(parts);
  describe("filterTimelineCred", () => {
    it("returns an empty object for empty cred", () => {
      expect(filterTimelineCred([], [], [])).toEqual({
        intervals: [],
        addressToCred: new Map(),
      });
    });
    it("appropriately filters a simple example", () => {
      const fullCred = [
        {
          interval: {startTimeMs: 0, endTimeMs: 10},
          cred: new Float64Array([1, 2, 3]),
        },
        {
          interval: {startTimeMs: 10, endTimeMs: 20},
          cred: new Float64Array([4, 5, 6]),
        },
      ];
      const nodeOrder = [na("foo"), na("bar"), na("zod")];
      const prefixes = [na("foo"), na("bar")];
      const expected = {
        intervals: fullCred.map((x) => x.interval),
        addressToCred: new Map().set(na("foo"), [1, 4]).set(na("bar"), [2, 5]),
      };
      expect(filterTimelineCred(fullCred, nodeOrder, prefixes)).toEqual(
        expected
      );
    });
  });
});
