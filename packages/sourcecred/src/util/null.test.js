// @flow

import * as NullUtil from "./null";

describe("util/null", () => {
  describe("map", () => {
    function sevens(n: ?number): ?string {
      return NullUtil.map(n, (n: number) => "7".repeat(n) + "!");
    }
    it("applies a function to a present value", () => {
      expect(sevens(3)).toEqual("777!");
    });
    it("passes through `null`", () => {
      expect(sevens(null)).toEqual(null);
    });
    it("passes through `undefined`", () => {
      expect(sevens(undefined)).toEqual(undefined);
    });
    it("treats `0` as present", () => {
      expect(sevens(0)).toEqual("!");
    });
    it("treats `false` as present", () => {
      expect(NullUtil.map(false, (x) => x === false)).toEqual(true);
    });
    it("treats `NaN` as present", () => {
      expect(NullUtil.map(NaN, (x) => isNaN(x))).toEqual(true);
    });
    it("treats an empty string as present", () => {
      expect(NullUtil.map("", (x) => x === "")).toEqual(true);
    });
  });

  describe("get", () => {
    it("gets a normal present value", () => {
      expect((NullUtil.get((3: ?number)): number)).toEqual(3);
    });
    it("throws a default-message error on `null`", () => {
      expect(() => (NullUtil.get((null: ?number)): number)).toThrow(/^null$/);
    });
    it("throws a default-message error on `undefined`", () => {
      expect(() => (NullUtil.get((undefined: ?number)): number)).toThrow(
        /^undefined$/
      );
    });
    it("throws a custom error on `null`", () => {
      expect(() => (NullUtil.get((null: ?number), "uh oh"): number)).toThrow(
        /^uh oh$/
      );
    });
    it("throws a custom error on `undefined`", () => {
      expect(
        () => (NullUtil.get((undefined: ?number), "oh dear"): number)
      ).toThrow(/^oh dear$/);
    });
    it("treats `0` as present", () => {
      expect(NullUtil.get(0)).toEqual(0);
    });
    it("treats `false` as present", () => {
      expect(NullUtil.get(false)).toEqual(false);
    });
    it("treats `NaN` as present", () => {
      expect(NullUtil.get(NaN)).toEqual(NaN);
    });
    it("treats the empty string as present", () => {
      expect(NullUtil.get("")).toEqual("");
    });
  });

  describe("orThrow", () => {
    function expectPresent<T>(x: T): void {
      const fn = jest.fn();
      expect((NullUtil.orThrow((x: ?T), fn): T)).toEqual(x);
      expect(fn).not.toHaveBeenCalled();
    }
    it("throws the provided message on `null`", () => {
      const fn: JestMockFn<$ReadOnlyArray<void>, string> = jest
        .fn()
        .mockReturnValueOnce("uh oh");
      expect(() => (NullUtil.orThrow((null: ?number), fn): number)).toThrow(
        /^uh oh$/
      );
      expect(fn.mock.calls).toEqual([[]]);
    });
    it("throws a custom error on `undefined`", () => {
      const fn: JestMockFn<$ReadOnlyArray<void>, string> = jest
        .fn()
        .mockReturnValueOnce("oh dear");
      expect(
        () => (NullUtil.orThrow((undefined: ?number), fn): number)
      ).toThrow(/^oh dear$/);
      expect(fn.mock.calls).toEqual([[]]);
    });
    it("gets a normal present value", () => {
      expectPresent(3);
    });
    it("treats `0` as present", () => {
      expectPresent(0);
    });
    it("treats `false` as present", () => {
      expectPresent(false);
    });
    it("treats `NaN` as present", () => {
      expectPresent(NaN);
    });
    it("treats the empty string as present", () => {
      expectPresent("");
    });
  });

  describe("orElse", () => {
    it("gets a normal present value", () => {
      expect((NullUtil.orElse((3: ?number), 17): number)).toEqual(3);
    });
    it("returns the default value given `null`", () => {
      expect((NullUtil.orElse((null: ?number), 17): number)).toEqual(17);
    });
    it("returns the default value given `undefined`", () => {
      expect((NullUtil.orElse((undefined: ?number), 17): number)).toEqual(17);
    });
    it("treats `0` as present", () => {
      expect(NullUtil.orElse(0, 17)).toEqual(0);
    });
    it("treats `false` as present", () => {
      expect(NullUtil.orElse(false, true)).toEqual(false);
    });
    it("treats `NaN` as present", () => {
      expect(NullUtil.orElse(NaN, 123)).toEqual(NaN);
    });
    it("treats the empty string as present", () => {
      expect(NullUtil.orElse("", "not me")).toEqual("");
    });
  });

  describe("filterList", () => {
    it("filters out undefined and null but not other falsey values", () => {
      const x = [0, undefined, NaN, null, false, ""];
      const f = NullUtil.filterList(x);
      expect(f).toEqual([0, NaN, false, ""]);
    });
    it("typechecks as expected", () => {
      const rs: $ReadOnlyArray<?string> = ["foo", undefined];
      const _: string[] = NullUtil.filterList(rs);
    });
    it("returns a copy of the original array", () => {
      const as = [1, 2, 3];
      const bs = NullUtil.filterList(as);
      expect(as).not.toBe(bs);
    });
    it("doesn't allow bad coercions", () => {
      const as = [1, "foo", 2];
      // $FlowExpectedError[incompatible-type]
      const _: number[] = NullUtil.filterList(as);
    });
  });
});
