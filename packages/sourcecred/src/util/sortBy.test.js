// @flow

import deepFreeze from "deep-freeze";
import sortBy from "./sortBy";

describe("util/sortBy", () => {
  const numericSample = deepFreeze([4, 2, 1, 8, 16]);
  const objectsSample = deepFreeze([
    {
      group: 1,
      key: "bbb",
      value: 8,
    },
    {
      group: 1,
      key: "ccc",
      value: 32,
    },
    {
      group: 2,
      key: "aaa",
      value: 16,
    },
    {
      group: 2,
      key: "ddd",
      value: 4,
    },
  ]);

  describe("sortBy", () => {
    it("should sort in ascending order", () => {
      const input = numericSample;
      const output = sortBy(input);
      expect(output).toEqual([1, 2, 4, 8, 16]);
    });

    it("should support plucking to a number", () => {
      const input = objectsSample;
      const output = sortBy(input, (x) => x.value);
      expect(output).toEqual([
        {
          group: 2,
          key: "ddd",
          value: 4,
        },
        {
          group: 1,
          key: "bbb",
          value: 8,
        },
        {
          group: 2,
          key: "aaa",
          value: 16,
        },
        {
          group: 1,
          key: "ccc",
          value: 32,
        },
      ]);
    });

    it("should support plucking to a string", () => {
      const input = objectsSample;
      const output = sortBy(input, (x) => x.key);
      expect(output).toEqual([
        {
          group: 2,
          key: "aaa",
          value: 16,
        },
        {
          group: 1,
          key: "bbb",
          value: 8,
        },
        {
          group: 1,
          key: "ccc",
          value: 32,
        },
        {
          group: 2,
          key: "ddd",
          value: 4,
        },
      ]);
    });

    it("should support plucking multiple levels", () => {
      const input = objectsSample;
      const output = sortBy(
        input,
        (x) => x.group,
        (x) => x.key
      );
      expect(output).toEqual([
        {
          group: 1,
          key: "bbb",
          value: 8,
        },
        {
          group: 1,
          key: "ccc",
          value: 32,
        },
        {
          group: 2,
          key: "aaa",
          value: 16,
        },
        {
          group: 2,
          key: "ddd",
          value: 4,
        },
      ]);
    });

    it("should create a shallow copy", () => {
      const mutationTarget = {
        key: "ddd",
        value: 4,
      };

      const input = [mutationTarget, ...objectsSample];
      const output = sortBy(input, (x) => x.value);
      mutationTarget.key = "mutated";

      expect(output).not.toBe(input);
      expect(input[0]).toBe(mutationTarget);
      expect(output[0]).toBe(mutationTarget);
      expect(output[0].key).toBe("mutated");
    });
  });
});
