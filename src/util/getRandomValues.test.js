// @flow

import getRandomValues from "./getRandomValues";

describe("util/getRandomValues", () => {
  it("populates a buffer", () => {
    const buf = new Uint8Array(1024);
    getRandomValues(buf);
    expect(buf.every((x) => x === 0)).toBe(false);
  });
  it("complains if buffer.length > 65536", () => {
    const buf = new Uint8Array(65537);
    expect(() => void getRandomValues(buf)).toThrow(/Quota exceeded/);
  });
});
