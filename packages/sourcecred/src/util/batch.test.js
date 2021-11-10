// @flow

import {batchArray, batchIterator} from "./batch";

describe("src/util/batch", () => {
  describe("batch", () => {
    it("batches an array bigger than the batch size", () => {
      expect(batchArray([1, 2, 3, 4, 5, 6, 7, 8], 3)).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ]);
    });
    it("batches an array smaller than the batch size", () => {
      expect(batchArray([1, 2], 3)).toEqual([[1, 2]]);
    });
    it("batches an array equal to the batch size", () => {
      expect(batchArray([1, 2, 3], 3)).toEqual([[1, 2, 3]]);
    });
    it("returns an empty array for an empty array", () => {
      expect(batchArray([], 3)).toEqual([]);
    });
    it("works when batch size is 1", () => {
      expect(batchArray([1, 2], 1)).toEqual([[1], [2]]);
    });
    it("throws when batch size is <1", () => {
      expect(() => {
        batchArray([0, 1], 0);
      }).toThrowError("BatchSize must be 1 or more.");
    });
  });

  describe("batchIterator", () => {
    const getResult = (iterator) => {
      const result = [];
      while (iterator.hasNext()) {
        const batch = [];
        for (const item of iterator) {
          batch.push(item);
        }
        result.push(batch);
      }
      return result;
    };

    it("batches an iterator bigger than the batch size", () => {
      const iterator = batchIterator(
        // $FlowFixMe[incompatible-use]
        [1, 2, 3, 4, 5, 6, 7, 8][Symbol.iterator](),
        3
      );

      expect(getResult(iterator)).toEqual([
        [1, 2, 3],
        [4, 5, 6],
        [7, 8],
      ]);
      expect(iterator.numBatchesCompleted()).toEqual(3);
    });
    it("batches an iterator equal to the batch size", () => {
      const iterator = batchIterator(
        // $FlowFixMe[incompatible-use]
        [1, 2, 3][Symbol.iterator](),
        3
      );
      expect(getResult(iterator)).toEqual([[1, 2, 3]]);
      expect(iterator.numBatchesCompleted()).toEqual(1);
    });
    it("batches an iterator smaller than the batch size", () => {
      const iterator = batchIterator(
        // $FlowFixMe[incompatible-use]
        [1, 2][Symbol.iterator](),
        3
      );
      expect(getResult(iterator)).toEqual([[1, 2]]);
      expect(iterator.numBatchesCompleted()).toEqual(1);
    });
    it("works when batch size is 1", () => {
      const iterator = batchIterator(
        // $FlowFixMe[incompatible-use]
        [1, 2][Symbol.iterator](),
        1
      );
      expect(getResult(iterator)).toEqual([[1], [2]]);
      expect(iterator.numBatchesCompleted()).toEqual(2);
    });
    it("throws when batch size is <1", () => {
      expect(() => {
        batchIterator(
          // $FlowFixMe[incompatible-use]
          [1, 2][Symbol.iterator](),
          0
        );
      }).toThrowError("BatchSize must be 1 or more.");
    });
    it("batches an empty iterator", () => {
      const iterator = batchIterator(
        // $FlowFixMe[incompatible-use]
        [][Symbol.iterator](),
        3
      );
      expect(getResult(iterator)).toEqual([]);
      expect(iterator.numBatchesCompleted()).toEqual(0);
    });
  });
});
