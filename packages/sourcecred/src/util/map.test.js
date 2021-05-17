// @flow

import * as MapUtil from "./map";
import {mapToArray} from "./map";

describe("util/map", () => {
  describe("toObject", () => {
    it("works on a map with string keys", () => {
      const input: Map<string, number> = new Map().set("one", 1).set("two", 2);
      const output: {[string]: number} = MapUtil.toObject(input);
      expect(output).toEqual({one: 1, two: 2});
    });
    it("works on a map with keys a subtype of string", () => {
      type Fruit = "APPLE" | "ORANGE";
      const input: Map<Fruit, string> = new Map()
        .set("APPLE", "good")
        .set("ORANGE", "also good");
      const output: {[Fruit]: string} = MapUtil.toObject(input);
      expect(output).toEqual({APPLE: "good", ORANGE: "also good"});
    });
    it("can return an exact object", () => {
      const _: {|[string]: number|} = MapUtil.toObject(new Map().set("a", 1));
    });
    it("can return an inexact object", () => {
      // This should be free: exact objects are subtypes of their
      // inexact counterparts.
      const _: {[string]: number} = MapUtil.toObject(new Map().set("a", 1));
    });
    it("statically rejects a map with keys not a subtype of string", () => {
      const input: Map<number, string> = new Map()
        .set(12, "not okay")
        .set(13, "also not okay");
      // $FlowExpectedError[incompatible-call]
      MapUtil.toObject(input);
    });
    it("statically refuses to output an object with non-string keys", () => {
      const input: Map<string, number> = new Map().set("one", 1).set("two", 2);
      // $FlowExpectedError[incompatible-type]
      const _: {[string | number]: number} = MapUtil.toObject(input);
    });
    it("allows upcasting the key and value types of the result object", () => {
      type Fruit = "APPLE" | "ORANGE";
      type Froot = "APPLE" | "ORANGE" | "BRICK";
      const input: Map<Fruit, string> = new Map()
        .set("APPLE", "good")
        .set("ORANGE", "also good");
      const _: {[Froot]: string | void} = MapUtil.toObject(input);
    });
  });

  describe("fromObject", () => {
    it("works on an object with string keys", () => {
      const input: {[string]: number} = {one: 1, two: 2};
      const output: Map<string, number> = MapUtil.fromObject(input);
      expect(output).toEqual(new Map().set("one", 1).set("two", 2));
    });
    it("works on an object with keys a subtype of string", () => {
      type Fruit = "APPLE" | "ORANGE";
      const input: {[Fruit]: string} = {APPLE: "good", ORANGE: "also good"};
      const output: Map<Fruit, string> = MapUtil.fromObject(input);
      expect(output).toEqual(
        new Map().set("APPLE", "good").set("ORANGE", "also good")
      );
    });
    it("can accept an inexact object", () => {
      const o: {[string]: number} = {a: 1};
      const _: Map<string, number> = MapUtil.fromObject(o);
    });
    it("can accept an exact object", () => {
      // This should be free: exact objects are subtypes of their
      // inexact counterparts.
      const o: {|[string]: number|} = ({a: 1}: any);
      const _: Map<string, number> = MapUtil.fromObject(o);
    });
    it("can accept a read-only object", () => {
      const o: {+[string]: number} = {a: 1};
      const _: Map<string, number> = MapUtil.fromObject(o);
    });
    it("statically rejects a map with keys not a subtype of string", () => {
      const input: {[number]: string} = {};
      input[12] = "not okay";
      input[13] = "also not okay";
      // $FlowExpectedError[incompatible-call]
      MapUtil.fromObject(input);
      // If that were valid, then `(result.keys(): Iterator<number>)`
      // would contain the strings "12" and "13".
    });
    it("allows upcasting the key and value types of the result map", () => {
      type Fruit = "APPLE" | "ORANGE";
      type Froot = "APPLE" | "ORANGE" | "BRICK";
      const input: {[Fruit]: string} = {APPLE: "good", ORANGE: "also good"};
      const output: Map<Froot, string | void> = MapUtil.fromObject(input);
      expect(output).toEqual(
        new Map().set("APPLE", "good").set("ORANGE", "also good")
      );
    });
    it("allows upcasting the result map's key type to non-strings", () => {
      // Contrast with `toObject`, where this is not and must not be
      // permitted.
      type Fruit = "APPLE" | "ORANGE";
      type Froot = "APPLE" | "ORANGE" | "BRICK" | number;
      const input: {[Fruit]: string} = {APPLE: "good", ORANGE: "also good"};
      const output: Map<Froot, string> = MapUtil.fromObject(input);
      expect(output).toEqual(
        new Map().set("APPLE", "good").set("ORANGE", "also good")
      );
    });
  });

  describe("copy", () => {
    it("returns a reference-distinct but value-equal map", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.copy(input);
      expect(input).not.toBe(output);
      expect(input).toEqual(output);
    });
    it("returns a map that is not linked to the original", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.copy(input);
      input.set(3, "three");
      output.set(4, "four");
      expect(input).toEqual(
        new Map().set(1, "one").set(2, "two").set(3, "three")
      );
      expect(output).toEqual(
        new Map().set(1, "one").set(2, "two").set(4, "four")
      );
    });
    it("allows upcasting the key and value types of the result map", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const _: Map<number | boolean, string | void> = MapUtil.copy(input);
    });
  });

  describe("mapKeys", () => {
    it("works in a simple case", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.mapKeys(input, (n) => n + 10);
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set(11, "one").set(12, "two"));
    });
    it("provides the corresponding value", () => {
      const input: Map<number, string> = new Map()
        .set(1, "one")
        .set(2, "twooo");
      const output: Map<number, string> = MapUtil.mapKeys(
        input,
        (n, s) => n + s.length
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "twooo"));
      expect(output).toEqual(new Map().set(4, "one").set(7, "twooo"));
    });
    it("allows mapping to a different key type", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<string, string> = MapUtil.mapKeys(
        input,
        (n) => n + "!"
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set("1!", "one").set("2!", "two"));
    });
    it("allows upcasting the value type", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string | void> = MapUtil.mapKeys(
        input,
        (n) => n + 10
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set(11, "one").set(12, "two"));
    });
    it("throws on a non-injective key-mapping function", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      expect(() => MapUtil.mapKeys(input, (_) => 0)).toThrow(
        "duplicate key: 0"
      );
    });
  });

  describe("mapValues", () => {
    it("works in a simple case", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.mapValues(
        input,
        (_, s) => s + "!"
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set(1, "one!").set(2, "two!"));
    });
    it("provides the corresponding key", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.mapValues(
        input,
        (n, s) => s + "!".repeat(n)
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set(1, "one!").set(2, "two!!"));
    });
    it("allows mapping to a different value type", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string[]> = MapUtil.mapValues(input, (_, s) =>
        s.split("")
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(
        new Map().set(1, ["o", "n", "e"]).set(2, ["t", "w", "o"])
      );
    });
    it("allows upcasting the key type", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number | void, string> = MapUtil.mapValues(
        input,
        (_, n) => n + "!"
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set(1, "one!").set(2, "two!"));
    });
    it("permits a non-injective value-mapping function", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.mapValues(
        input,
        (_unused_key, _unused_value) => "wat"
      );
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set(1, "wat").set(2, "wat"));
    });
  });

  describe("mapEntries", () => {
    it("works in a simple case", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.mapEntries(input, (n, s) => [
        -n,
        "negative " + s,
      ]);
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(
        new Map().set(-1, "negative one").set(-2, "negative two")
      );
    });
    it("allows mapping to different key and value types", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<string, number> = MapUtil.mapEntries(input, (k, v) => [
        v,
        k,
      ]);
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set("one", 1).set("two", 2));
    });
    it("throws on a non-injective key-mapping function", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      expect(() => MapUtil.mapEntries(input, (_, v) => ["wat", v])).toThrow(
        "duplicate key: wat"
      );
    });
    it("permits a non-injective value-mapping function", () => {
      const input: Map<number, string> = new Map().set(1, "one").set(2, "two");
      const output: Map<number, string> = MapUtil.mapEntries(input, (k, _) => [
        k + 10,
        "wat",
      ]);
      expect(input).toEqual(new Map().set(1, "one").set(2, "two"));
      expect(output).toEqual(new Map().set(11, "wat").set(12, "wat"));
    });
  });
  describe("merge", () => {
    it("combines two simple maps", () => {
      const a = new Map().set("a", 1);
      const b = new Map().set("b", 2);
      const c = new Map().set("c", 3);
      expect(MapUtil.merge([a, b, c])).toEqual(
        new Map().set("a", 1).set("b", 2).set("c", 3)
      );
    });
    it("treats empty map as an identity", () => {
      const m = new Map().set("a", 11).set("b", 22);
      expect(MapUtil.merge([new Map(), m, new Map()])).toEqual(m);
    });
    it("errors if there are any duplicate keys", () => {
      const a = new Map().set("a", null);
      expect(() => MapUtil.merge([a, a])).toThrowError("duplicate key");
    });
    it("handles null and undefined appropriately", () => {
      const a = new Map().set(undefined, undefined);
      const b = new Map().set(null, null);
      expect(MapUtil.merge([a, b])).toEqual(
        new Map().set(undefined, undefined).set(null, null)
      );
    });
    it("merge works on empty list", () => {
      expect(MapUtil.merge([])).toEqual(new Map());
    });
    it("produces expected type errors", () => {
      const numberMap: Map<number, number> = new Map().set(1, 2);
      const stringMap: Map<string, string> = new Map().set("one", "two");
      // $FlowExpectedError[incompatible-type-arg]
      const _unused_badMap: Map<string, number> = MapUtil.merge([
        numberMap,
        // $FlowExpectedError[incompatible-call]
        stringMap,
      ]);
    });
  });
  describe("pushValue", () => {
    it("works when the map has no matching key", () => {
      const map = new Map();
      MapUtil.pushValue(map, "foo", 3);
      expect(map).toEqual(new Map().set("foo", [3]));
    });
    it("works when the map has a matching key", () => {
      const map = new Map().set("foo", [3]);
      MapUtil.pushValue(map, "foo", 4);
      expect(map).toEqual(new Map().set("foo", [3, 4]));
    });
    it("works when the map already has an empty array", () => {
      const map = new Map().set("foo", []);
      MapUtil.pushValue(map, "foo", 1);
      expect(map).toEqual(new Map().set("foo", [1]));
    });
    it("preserves array identity", () => {
      const arr = [];
      const map = new Map().set("foo", arr);
      MapUtil.pushValue(map, "foo", 1);
      expect(map.get("foo")).toBe(arr);
    });
    it("returns the resultant array", () => {
      const arr = [];
      const map = new Map().set("foo", arr);
      const result = MapUtil.pushValue(map, "foo", 1);
      expect(result).toBe(arr);
    });
  });

  describe("mapToArray", () => {
    const fn = ([key, val]) => ({key, val});

    it("works for an empty map", () => {
      const map = new Map();

      expect(mapToArray(map, fn)).toEqual([]);
    });

    it("works for simple use case", () => {
      const map = new Map([
        ["foo", 1],
        ["bar", 2],
      ]);

      const expected = [
        {
          key: "foo",
          val: 1,
        },
        {
          key: "bar",
          val: 2,
        },
      ];
      expect(mapToArray(map, fn)).toEqual(expected);
    });

    it("should provide the index to the function", () => {
      const map = new Map([
        ["foo", 1],
        ["bar", 99],
      ]);

      const expected = [0, 1];
      expect(mapToArray(map, (_, i) => i)).toEqual(expected);
    });
  });
});
