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
        // This is a defense-in-depth test---undefined isn't actually a
        // valid JSON value---so silence Flow's justified complaint.
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

<<<<<<< HEAD
  describe("pure", () => {
    it("does what it says on the tin", () => {
      type Color = "RED" | "GREEN" | "BLUE";
      const p: C.Parser<Color> = C.pure("GREEN");
      expect(p.parseOrThrow(p)).toEqual("GREEN");
    });
  });

  describe("fmap", () => {
    type Color = "RED" | "GREEN" | "BLUE";
    function stringToColor(s: string): Color {
      const c = s.toLowerCase().charAt(0);
      switch (c) {
        case "r":
          return "RED";
        case "g":
          return "GREEN";
        case "b":
          return "BLUE";
        default:
          throw new Error("unknown color: " + JSON.stringify(s));
      }
    }
    it("handles the success case", () => {
      const p: C.Parser<Color> = C.fmap(C.string, stringToColor);
      expect(p.parseOrThrow("blu")).toEqual("BLUE");
    });
    it("handles failure of the base parser", () => {
      const p: C.Parser<Color> = C.fmap(C.string, stringToColor);
      const thunk = () => p.parseOrThrow(77);
      expect(thunk).toThrow("expected string, got number");
    });
    it("handles `Error`s thrown by the mapping function", () => {
      const p: C.Parser<Color> = C.fmap(C.string, stringToColor);
      // Avoid `.toThrow` because that checks for a substring, and we
      // want to ensure no "Error: " prefix is included.
      expect(p.parse("wat")).toEqual({ok: false, err: 'unknown color: "wat"'});
    });
    it("handles failure of the mapping function", () => {
      const p: C.Parser<Color> = C.fmap(C.string, () => {
        throw 123;
      });
      expect(p.parse("wat")).toEqual({ok: false, err: "123"});
    });
    it("composes", () => {
      const raw: C.Parser<string> = C.string;
      const trimmed: C.Parser<string> = C.fmap(raw, (s) => s.trim());
      const color: C.Parser<Color> = C.fmap(trimmed, stringToColor);
      expect(color.parseOrThrow("  blu\n\n")).toEqual("BLUE");
    });
    it("is type-safe", () => {
      // input safety
      // $ExpectFlowError
      C.fmap(C.string, (n: number) => n.toFixed());
      // output safety
      // $ExpectFlowError
      (C.fmap(C.number, (n: number) => n.toFixed()): C.Parser<number>);
    });
  });

=======
>>>>>>> 297c4e915670fe63c171f06022fa665598b7524a
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
