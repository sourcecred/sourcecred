// @flow

import {type Log, ArrayLog} from "./log";

describe("ledger/log", () => {
  describe("ArrayLog", () => {
    it("should be a typed log constructed from a factory function", () => {
      (ArrayLog(): Log<number>);
      (new ArrayLog(): Log<number>);
    });

    it("should match Flow's Iterable interface", () => {
      type _unused_isIterable = (Log<mixed>) => Iterable<mixed>;
    });

    it("should be empty initialy", () => {
      const log: Log<number> = new ArrayLog();
      expect(Array.from(log)).toEqual([]);
    });

    it("should append items in order", () => {
      const log: Log<number> = new ArrayLog();
      log.append([4, 1]);
      log.append([8]);
      log.append([6]);
      expect(Array.from(log)).toEqual([4, 1, 8, 6]);
    });

    it("should match EcmaScript's Iterable interface", () => {
      const log: Log<number> = new ArrayLog();
      log.append([1, 2, 3]);

      // $FlowExpectedError
      const iter: Iterator<number> = log[Symbol.iterator]();
      const items: number[] = Array.from(iter);
      expect(items).toEqual([1, 2, 3]);
    });

    it("should support for..of iteration", () => {
      const log: Log<number> = new ArrayLog();
      log.append([4, 5, 6]);
      for (const value of log) {
        expect(value).toEqual(expect.any(Number));
      }
    });

    it("should support a .values() iterator", () => {
      const log: Log<number> = new ArrayLog();
      log.append([7, 8, 9]);
      const iter: Iterator<number> = log.values();
      const items: number[] = Array.from(iter);
      expect(items).toEqual([7, 8, 9]);
    });

    it("should not mutate existing iterators on append", () => {
      const log: Log<number> = new ArrayLog();
      log.append([1, 2]);
      const iter: Iterator<number> = log.values();
      log.append([3, 4]);
      const items: number[] = Array.from(iter);
      expect(items).toEqual([1, 2]);
    });
  });
});
