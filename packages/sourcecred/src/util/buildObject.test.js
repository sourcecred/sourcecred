// @flow

import {buildObject} from "./buildObject";

describe("src/util/buildObject", () => {
  type TestT = {|+s: string, +n?: number|};

  it("adds defined optionals", () => {
    expect(buildObject<TestT>({s: "test"}, {n: 1})).toEqual({s: "test", n: 1});
  });
  it("excludes undefined optionals", () => {
    expect(buildObject<TestT>({s: "test"}, {n: undefined})).toEqual({
      s: "test",
    });
  });
  it("excludes optionals with manually-defined exclusions", () => {
    expect(buildObject<TestT>({s: "test"}, {n: 1}, [1])).toEqual({
      s: "test",
    });
  });
});
