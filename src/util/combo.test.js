// @flow

import * as C from "./combo";

describe("src/util/combo", () => {
  describe("primitives", () => {
    describe("string", () => {
      it("accepts strings", () => {
        expect(C.string.parseOrThrow("hey")).toEqual("hey");
      });
      it("rejects numbers", () => {
        const thunk = () => C.string.parseOrThrow(77);
        expect(thunk).toThrow("expected string, got number");
      });
      it("rejects nulls", () => {
        const thunk = () => C.string.parseOrThrow(null);
        expect(thunk).toThrow("expected string, got null");
      });
    });

    describe("number", () => {
      it("accepts numbers", () => {
        expect(C.number.parseOrThrow(77)).toEqual(77);
      });
      it("rejects strings", () => {
        const thunk = () => C.number.parseOrThrow("hey");
        expect(thunk).toThrow("expected number, got string");
      });
      it("rejects arrays", () => {
        const thunk = () => C.number.parseOrThrow([2, 3, 4]);
        expect(thunk).toThrow("expected number, got array");
      });
      it("rejects strings that look like numbers", () => {
        const thunk = () => C.number.parseOrThrow("77");
        expect(thunk).toThrow("expected number, got string");
      });
    });

    describe("boolean", () => {
      it("accepts true", () => {
        expect(C.boolean.parseOrThrow(true)).toEqual(true);
      });
      it("accepts false", () => {
        expect(C.boolean.parseOrThrow(true)).toEqual(true);
      });
      it("rejects null", () => {
        const thunk = () => C.boolean.parseOrThrow(null);
        expect(thunk).toThrow("expected boolean, got null");
      });
      it("rejects objects", () => {
        const thunk = () => C.boolean.parseOrThrow({});
        expect(thunk).toThrow("expected boolean, got object");
      });
    });

    describe("null_", () => {
      it("accepts null", () => {
        expect(C.null_.parseOrThrow(null)).toEqual(null);
      });
      it("rejects undefined", () => {
        // This is a defense-in-depth test---undefined isn't actually a valid JSON value---so silence Flow's justified complaint.
        const undef: C.JsonObject = (undefined: any);
        const thunk = () => C.null_.parseOrThrow(undef);
        expect(thunk).toThrow("expected null, got undefined");
      });
      it("rejects falsy strings", () => {
        const thunk = () => C.null_.parseOrThrow("");
        expect(thunk).toThrow("expected null, got string");
      });
      it("rejects falsy numbers", () => {
        const thunk = () => C.null_.parseOrThrow(0);
        expect(thunk).toThrow("expected null, got number");
      });
    });
  });

  describe("array", () => {
    it("accepts an empty array", () => {
      const p: C.Parser<string[]> = C.array(C.string);
      expect(p.parseOrThrow([])).toEqual([]);
    });
    it("accepts a singleton array", () => {
      const p: C.Parser<string[]> = C.array(C.string);
      expect(p.parseOrThrow(["one"])).toEqual(["one"]);
    });
    it("accepts a long array", () => {
      const p: C.Parser<string[]> = C.array(C.string);
      expect(p.parseOrThrow(["a", "b", "c"])).toEqual(["a", "b", "c"]);
    });
    it("works for nested array types", () => {
      const p: C.Parser<string[][]> = C.array(C.array(C.string));
      expect(p.parseOrThrow([["a", "b"], ["c"]])).toEqual([["a", "b"], ["c"]]);
    });
    it("rejects on an object with numeric-string keys", () => {
      const p: C.Parser<string[][]> = C.array(C.array(C.string));
      const input = {"0": "hmm", "1": "hum"};
      const thunk = () => p.parseOrThrow(input);
      expect(thunk).toThrow("expected array, got object");
    });
    it("rejects arrays with elements of the wrong type", () => {
      const p: C.Parser<string[]> = C.array(C.string);
      const input = ["one", "two", 5];
      const thunk = () => p.parseOrThrow(input);
      expect(thunk).toThrow("index 2: expected string, got number");
    });
    it("has nice error messages on nested arrays", () => {
      const p: C.Parser<string[][]> = C.array(C.array(C.string));
      const input = [["one"], ["two"], [5, "---three, sir"]];
      const thunk = () => p.parseOrThrow(input);
      expect(thunk).toThrow("index 2: index 0: expected string, got number");
    });
    it("is type-safe", () => {
      // $ExpectFlowError
      (C.array(C.string): C.Parser<string>);
      // $ExpectFlowError
      (C.array(C.string): C.Parser<number[]>);
      // $ExpectFlowError
      (C.array(C.string): C.Parser<string[][]>);
    });
  });
});
