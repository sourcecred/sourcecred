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

  describe("object", () => {
    it("type-errors if the unique field doesn't match", () => {
      // $ExpectFlowError
      (C.object({name: C.string}): C.Parser<{|+name: number|}>);
    });
    it("type-errors if two fields on an object are swapped", () => {
      // $ExpectFlowError
      (C.object({name: C.string, age: C.number}): C.Parser<{|
        +name: number,
        +age: string,
      |}>);
    });
    it("type-errors if two optional fields on an object are swapped", () => {
      // $ExpectFlowError
      (C.object(
        {id: C.string},
        {maybeName: C.string, maybeAge: C.number}
      ): C.Parser<{|
        +id: string,
        +maybeName?: number,
        +maybeAge?: string,
      |}>);
    });
    it("type-errors on bad required fields when optionals present", () => {
      // $ExpectFlowError
      (C.object({name: C.string, age: C.number}, {hmm: C.boolean}): C.Parser<{|
        +name: number,
        +age: string,
        +hmm?: boolean,
      |}>);
    });
    it("type-errors on bad required fields when empty optionals present", () => {
      // $ExpectFlowError
      (C.object({name: C.string, age: C.number}, {}): C.Parser<{|
        +name: number,
        +age: string,
        +hmm?: boolean,
      |}>);
    });
    it("accepts an object with one field", () => {
      const p: C.Parser<{|+name: string|}> = C.object({name: C.string});
      expect(p.parseOrThrow({name: "alice"})).toEqual({name: "alice"});
    });
    it("accepts an object with two fields at distinct types", () => {
      const p: C.Parser<{|+name: string, +age: number|}> = C.object({
        name: C.string,
        age: C.number,
      });
      expect(p.parseOrThrow({name: "alice", age: 42})).toEqual({
        name: "alice",
        age: 42,
      });
    });
    it("ignores extraneous fields on input values", () => {
      const p: C.Parser<{|+name: string, +age: number|}> = C.object({
        name: C.string,
        age: C.number,
      });
      expect(p.parseOrThrow({name: "alice", age: 42, hoopy: true})).toEqual({
        name: "alice",
        age: 42,
      });
    });
    it("rejects an object with missing fields", () => {
      const p: C.Parser<{|+name: string, +age: number|}> = C.object({
        name: C.string,
        age: C.number,
      });
      const thunk = () => p.parseOrThrow({name: "alice"});
      expect(thunk).toThrow('missing key: "age"');
    });
    it("rejects an object with fields at the wrong type", () => {
      const p: C.Parser<{|+name: string, +age: number|}> = C.object({
        name: C.string,
        age: C.number,
      });
      const thunk = () => p.parseOrThrow({name: "alice", age: "secret"});
      expect(thunk).toThrow('key "age": expected number, got string');
    });
    it("rejects arrays", () => {
      const p = C.object({name: C.string});
      const thunk = () => p.parseOrThrow(["alice", "bob"]);
      expect(thunk).toThrow("expected object, got array");
    });
    it("rejects null", () => {
      const p = C.object({name: C.string});
      const thunk = () => p.parseOrThrow(null);
      expect(thunk).toThrow("expected object, got null");
    });
    it("rejects strings", () => {
      const p = C.object({name: C.string});
      const thunk = () => p.parseOrThrow("hmm");
      expect(thunk).toThrow("expected object, got string");
    });
    describe("for objects with some required and some optional fields", () => {
      const p: C.Parser<{|
        +rs: string,
        +rn: number,
        +os?: string,
        +on?: number,
      |}> = C.object(
        {rs: C.string, rn: C.number},
        {os: C.string, on: C.number}
      );
      it("accepts values with none of the optional fields", () => {
        const v = {rs: "a", rn: 1};
        expect(p.parseOrThrow(v)).toEqual(v);
      });
      it("accepts values with a strict subset of the optional fields", () => {
        const v = {rs: "a", rn: 1, on: 9};
        expect(p.parseOrThrow(v)).toEqual(v);
      });
      it("accepts values with all the optional fields", () => {
        const v = {rs: "a", rn: 1, os: "z", on: 9};
        expect(p.parseOrThrow(v)).toEqual(v);
      });
    });
    describe("with field renaming", () => {
      const p: C.Parser<{|
        +one: number,
        +two: number,
        +three?: number,
        +four?: number,
      |}> = C.object(
        {one: C.number, two: C.rename("dos", C.number)},
        {three: C.number, four: C.rename("cuatro", C.number)}
      );
      it("renames both required and optional fields", () => {
        expect(p.parseOrThrow({one: 1, dos: 2, three: 3, cuatro: 4})).toEqual({
          one: 1,
          two: 2,
          three: 3,
          four: 4,
        });
      });
      it("provides missing key errors using the user-facing name", () => {
        const thunk = () => p.parseOrThrow({one: 1, cuatro: 4});
        expect(thunk).toThrow('missing key: "dos"');
      });
      it("only accepts the user-facing keys", () => {
        const thunk = () => p.parseOrThrow({one: 1, two: 2});
        expect(thunk).toThrow('missing key: "dos"');
      });
      it("only accepts the user-facing keys", () => {
        const thunk = () => p.parseOrThrow({one: 1, two: 2});
        expect(thunk).toThrow('missing key: "dos"');
      });
      it("allows mapping one old key to multiple new keys", () => {
        // This makes it a bit harder to see how to turn `object` into
        // an iso, but it's the intended behavior for now, so let's test
        // it.
        const p: C.Parser<{|
          +value: number,
          +valueAsString: string,
        |}> = C.object({
          value: C.number,
          valueAsString: C.rename(
            "value",
            C.fmap(C.number, (n) => n.toFixed())
          ),
        });
        expect(p.parseOrThrow({value: 7})).toEqual({
          value: 7,
          valueAsString: "7",
        });
      });
    });
    it("fails when `required` and `optional` have overlapping new keys", () => {
      expect(() => {
        // ...even if the parser types are compatible and the old keys
        // are different
        C.object({hmm: C.string}, {hmm: C.rename("hum", C.string)});
      }).toThrow('duplicate key: "hmm"');
    });
    it("forbids renaming a rename at the type level", () => {
      C.rename("old", C.string);
      // $ExpectFlowError
      (C.rename("old", C.string): C.Parser<string>);
      // $ExpectFlowError
      C.rename("hmm", C.rename("old", C.string));
    });
  });
});
