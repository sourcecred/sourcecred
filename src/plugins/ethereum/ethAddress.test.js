// @flow

import {
  parseAddress,
  truncateEthAddress as truncate,
  COMPAT_INFO,
  parser,
  type EthAddress,
} from "./ethAddress";
import {toCompat} from "../../util/compat";

describe("plugins/ethereum/ethAddress", () => {
  describe("parseAddress", () => {
    it("can parse a well-formed ethereum address", () => {
      [
        "2Ccc7cD913677553766873483ed9eEDdB77A0Bb0",
        "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0",
        "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0".toUpperCase(),
        "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0".toLowerCase(),
        // upper-case with lower-cased `0x`
        "0x2CCC7CD913677553766873483ED9EEDDB77A0BB0",
        // lower-case with upper-cased `0x`
        "0X2ccc7cd913677553766873483ed9eeddb77a0bb0",
      ].forEach((a: string) => {
        expect(parseAddress(a)).toBe(
          "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0"
        );
      });
    });
    it("throws when attempting to parse a malformed address", () => {
      [
        "0x",
        "abc123",
        "",
        // malformed mixed-case
        "0x2ccc7cD913677553766873483ed9eEDdB77A0Bb0",
        "2ccc7cD913677553766873483ed9eEDdB77A0Bb0",
      ].forEach((a: string) => {
        expect(() => parseAddress(a)).toThrow(
          `not a valid ethereum address: ${a}`
        );
      });
    });
  });

  describe("truncateEthAddress", () => {
    it("creates well-formed truncated addresses", () => {
      [
        [
          parseAddress("0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0"),
          "0x2Ccc...0Bb0",
        ],
        [
          parseAddress("0xb4124cEB3451635DAcedd11767f004d8a28c6eE7"),
          "0xb412...6eE7",
        ],
      ].forEach(([a, t]: [EthAddress, string]) => {
        expect(truncate(a)).toBe(t);
      });
    });
  });

  describe("compatible ethAddress", () => {
    const address1 = "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0";
    const address2 = "0xb4124cEB3451635DAcedd11767f004d8a28c6eE7";
    const address3 = "0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb";
    const addressArray = [address1, address2, address3];
    it("can create an exported ethAddress instance", () => {
      const compatibleEthLog = toCompat(COMPAT_INFO, addressArray);
      const result = parser.parseOrThrow(compatibleEthLog);
      expect(result).toEqual(addressArray);
    });
  });
});
