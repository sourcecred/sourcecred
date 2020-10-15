// @flow

import {
  nodeAddressForEthAddress,
  parseAddress,
  truncateEthAddress as truncate,
  COMPAT_INFO,
  parser,
  type EthAddress,
} from "./ethAddressFile";
import {NodeAddress} from "../../core/graph";
import {JsonLog} from "../../util/jsonLog";
import {toCompat} from "../../util/compat";

describe("plugins/ethereum/ethAddressFile", () => {
  describe("parseAddress", () => {
    it("can parse a well-formed ethereum address", () => {
      [
        "2Ccc7cD913677553766873483ed9eEDdB77A0Bb0",
        "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0",
        "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0".toUpperCase(),
        "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0".toLowerCase(),
      ].forEach((a: string) => {
        expect(parseAddress(a)).toBe(
          "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0"
        );
      });
    });
    it("throws when attempting to parse a malformed address", () => {
      [
        "0x",
        // malformed mixed-case
        "0x2ccc7cD913677553766873483ed9eEDdB77A0Bb0",
        "abc123",
        "",
      ].forEach((a: string) => {
        expect(() => parseAddress(a)).toThrow(
          `not a valid ethereum address: ${a}`
        );
      });
    });
  });

  describe("nodeAddressForEthAddress", () => {
    const exampleAddress = "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0";
    it("creates a valid node address when supplied an Eth Addres", () => {
      const result = nodeAddressForEthAddress(parseAddress(exampleAddress));
      expect(result).toEqual(
        NodeAddress.fromParts(["sourcecred", "ethereum", exampleAddress])
      );
    });
  });

  describe("truncateEthAddres", () => {
    it("creates well-formed truncated addresses", () => {
      [
        //$FlowExpectedError[incompatible-type]
        ["0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0", "0x2Ccc...0Bb0"],
        //$FlowExpectedError[incompatible-type]
        ["0xb4124cEB3451635DAcedd11767f004d8a28c6eE7", "0xb412...6eE7"],
      ].forEach(([a, t]: [EthAddress, string]) => {
        expect(truncate(a)).toBe(t);
      });
    });
  });

  describe("compatible JsonLog", () => {
    const address1 = "0x2Ccc7cD913677553766873483ed9eEDdB77A0Bb0";
    const address2 = "0xb4124cEB3451635DAcedd11767f004d8a28c6eE7";
    const address3 = "0x8401Eb5ff34cc943f096A32EF3d5113FEbE8D4Eb";
    const addressArray = [address1, address2, address3];
    it("can create an exported JsonLog instance", () => {
      const ethLog = new JsonLog();
      const compatibleEthLog = toCompat(
        COMPAT_INFO,
        ethLog.extend(addressArray).toString()
      );
      const result = parser.parseOrThrow(compatibleEthLog).values();
      expect(Array.from(result)).toEqual(addressArray);
    });
  });
});
