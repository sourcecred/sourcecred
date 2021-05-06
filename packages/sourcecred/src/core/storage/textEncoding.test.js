// @flow

import {decode, encode} from "./textEncoding";

describe("core/storage/textEncoding", () => {
  describe("round trip test", () => {
    it("can encode and decode a string", () => {
      const test = "test";
      const result = decode(encode(test));
      expect(test).toBe(result);
    });
  });
});
