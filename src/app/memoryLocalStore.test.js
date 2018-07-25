// @flow

import MemoryLocalStore from "./memoryLocalStore";

describe("src/app/memoryLocalStore", () => {
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
