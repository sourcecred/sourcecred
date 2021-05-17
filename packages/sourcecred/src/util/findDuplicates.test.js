// @flow

import {findDuplicates} from "./findDuplicates";

describe("util/findDuplicates", () => {
  it("should work on an example", () => {
    const input = [4, 5, 1, 1, 2, 3, 4, 1];
    const duplicates = new Set([1, 4]);
    expect(findDuplicates(input)).toEqual(duplicates);
  });
  it("should not use deep comparison", () => {
    const input = [{a: true}, {a: true}, [1], [1]];
    const duplicates = new Set([]);
    expect(findDuplicates(input)).toEqual(duplicates);
  });
  it("should work with object equality", () => {
    const obj = {b: true};
    const arr = [2];
    const input = [obj, obj, arr, arr, obj];
    const duplicates = new Set([obj, arr]);
    expect(findDuplicates(input)).toEqual(duplicates);
  });
});
