// @flow

import {random, fromString, parser, type Uuid} from "./uuid";

describe("util/uuid", () => {
  describe("random", () => {
    it("always returns a 22-character string that passes UUID tests", () => {
      for (let i = 0; i < 16; i++) {
        const uuid = random();
        expect(uuid).toHaveLength(22);
        expect(fromString(uuid)).toEqual(uuid);
      }
    });
  });
  describe("fromString", () => {
    function fail(input, message) {
      expect(() => fromString(input)).toThrow(message);
    }
    it("rejects the empty UUID", () => {
      fail("", 'expected length-22 string: ""');
    });
    it("rejects short UUIDs", () => {
      fail("NjRiaXRzOig", 'expected length-22 string: "NjRiaXRzOig"');
    });
    it("rejects long UUIDs", () => {
      fail(
        "MTYwIGJpdHMgaXMgdG9vIG1hbnk",
        'expected length-22 string: "MTYwIGJpdHMgaXMgdG9vIG1hbnk"'
      );
    });
    it("rejects UUIDs with 1 padding token", () => {
      fail(
        "YW55ICI9IiBzaWduIGJhZA=",
        'expected unpadded string: "YW55ICI9IiBzaWduIGJhZA="'
      );
    });
    it("rejects UUIDs with 2 padding tokens", () => {
      fail(
        "MTI4Yml0c2J1dHBhZGRlZA==",
        'expected unpadded string: "MTI4Yml0c2J1dHBhZGRlZA=="'
      );
    });
    it("rejects UUIDs with 3 padding tokens", () => {
      fail(
        "JiAzIGlzIHJpZ2h0IG91dA===",
        'expected unpadded string: "JiAzIGlzIHJpZ2h0IG91dA==="'
      );
    });
    it("rejects UUIDs with non-alphanumeric URL-safe characters", () => {
      fail("Y3J1ZWwgdHdpc3Qgb2Yg-A", 'unclean UUID: "Y3J1ZWwgdHdpc3Qgb2Yg-A"');
    });
    it("rejects strings that aren't valid base64 at all", () => {
      fail(
        "Extr@Symbol$NotGood???",
        'invalid base64 string: "Extr@Symbol$NotGood???"'
      );
    });
    it("rejects base64 strings with non-canonical final token", () => {
      fail(
        "enp6enp6enp6enp6enp6eh",
        'non-canonical base64 string: "enp6enp6enp6enp6enp6eh"'
      );
    });
    it("accepts a UUID that passes all the tests", () => {
      const input: string = "YVZhbGlkVXVpZEF0TGFzdA";
      const output: Uuid = fromString(input);
      expect(output).toEqual(input);
    });
  });
  describe("parser", () => {
    it("accepts a valid UUID", () => {
      expect(parser.parse("YVZhbGlkVXVpZEF0TGFzdA")).toEqual({
        ok: true,
        value: "YVZhbGlkVXVpZEF0TGFzdA",
      });
    });
    it("rejects an invalid UUID", () => {
      expect(parser.parse("hmm")).toEqual({
        ok: false,
        err: expect.stringContaining("length-22"),
      });
    });
  });
});
