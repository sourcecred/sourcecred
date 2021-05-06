// @flow

import MemoryLocalStore from "./memoryLocalStore";

describe("webutil/memoryLocalStore", () => {
  it("stores simple values", () => {
    const ls = new MemoryLocalStore();
    ls.set("one", 1);
    expect(ls.get("one")).toBe(1);
  });

  it("stores complex values", () => {
    const ls = new MemoryLocalStore();
    ls.set("stuff", [{a: ["one"]}, {b: ["two"]}]);
    expect(ls.get("stuff")).toEqual([{a: ["one"]}, {b: ["two"]}]);
  });

  it("stores null", () => {
    const ls = new MemoryLocalStore();
    ls.set("one", null);
    expect(ls.get("one")).toBe(null);
  });

  it("throws an error on undefined", () => {
    const ls = new MemoryLocalStore();
    const f = () => ls.set("one", undefined);
    expect(f).toThrowError("undefined");
  });

  it("overwrites values", () => {
    const ls = new MemoryLocalStore();
    ls.set("questions", 5);
    ls.set("questions", 3);
    expect(ls.get("questions")).toBe(3);
  });

  it("provides `whenUnavailable` for absent values", () => {
    const ls = new MemoryLocalStore();
    const expected = Symbol();
    expect(ls.get("wat", expected)).toBe(expected);
  });
});
