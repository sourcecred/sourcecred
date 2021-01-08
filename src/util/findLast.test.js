// @flow

import {findLast, findLastIndex} from "./findLast";

describe("util/findLast", () => {
  it("should work when the last object satisfies the condition", () => {
    const input = [4, 5, 6, 9];
    const testingFunction = (n) => n === 9;
    expect(findLast(input, testingFunction)).toEqual(9);
  });
  it("should work when the first object satisfies the condition", () => {
    const input = [4, 5, 6, 9];
    const testingFunction = (n) => n === 4;
    expect(findLast(input, testingFunction)).toEqual(4);
  });
  it("should return the last viable object when multiple objects satisfy the condition", () => {
    const input = [4, 5, 6, 9];
    const testingFunction = (n) => n < 7;
    expect(findLast(input, testingFunction)).toEqual(6);
  });
  it("should return undefined when no objects satisfy the condition", () => {
    const input = [4, 5, 6, 9];
    const testingFunction = (n) => n === 22;
    expect(findLast(input, testingFunction)).toEqual(undefined);
  });
  it("should return undefined when the array is empty", () => {
    const input = [];
    const testingFunction = (n) => n === 22;
    expect(findLast(input, testingFunction)).toEqual(undefined);
  });
});

describe("util/findLastIndex", () => {
  it("should work when the last object satisfies the condition", () => {
    const input = [4, 1, 1, 9];
    const testingFunction = (n) => n === 9;
    expect(findLastIndex(input, testingFunction)).toEqual(3);
  });
  it("should work when the first object satisfies the condition", () => {
    const input = [4, 1, 1, 9];
    const testingFunction = (n) => n === 4;
    expect(findLastIndex(input, testingFunction)).toEqual(0);
  });
  it("should return the last viable index when multiple objects satisfy the condition", () => {
    const input = [4, 1, 1, 9];
    const testingFunction = (n) => n === 1;
    expect(findLastIndex(input, testingFunction)).toEqual(2);
  });
  it("should return -1 when no objects satisfy the condition", () => {
    const input = [4, 1, 1, 9];
    const testingFunction = (n) => n === 22;
    expect(findLastIndex(input, testingFunction)).toEqual(-1);
  });
  it("should return -1 when the array is empty", () => {
    const input = [];
    const testingFunction = (n) => n === 22;
    expect(findLastIndex(input, testingFunction)).toEqual(-1);
  });
});
