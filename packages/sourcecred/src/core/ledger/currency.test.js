// @flow

import {parseEvmChainId, buildCurrency} from "./currency";
import {ETH_CURRENCY_ADDRESS} from "../../plugins/ethereum/ethAddress";

describe("core/ledger/currency", () => {
  describe("parseEvmChainId", () => {
    it("can parse integer strings", () => {
      const ARRAY_LENGTH = 50;
      const chainIds = Array.from(Array(ARRAY_LENGTH)).map((_unused_x, idx) =>
        (idx - ARRAY_LENGTH / 2).toString()
      );
      chainIds.forEach((id) => {
        const result = parseEvmChainId(id);
        expect(result).toBe(id);
      });
    });
    it("fails on non-integer values", () => {
      [5.5, Infinity, -Infinity, "Bob"].forEach((x) => {
        expect(() => parseEvmChainId(x.toString())).toThrow(
          `Invalid EVM chainId value: ${x}`
        );
      });
    });
  });
  describe("buildCurrency", () => {
    it("can build an evmId", () => {
      const result = buildCurrency(parseEvmChainId("1"), ETH_CURRENCY_ADDRESS);
      expect(result).toEqual({
        type: "EVM",
        chainId: "1",
        tokenAddress: ETH_CURRENCY_ADDRESS,
      });
    });
    it("can build a Protocol Identifier", () => {
      const result = buildCurrency("BTC");
      expect(result).toEqual({
        type: "PROTOCOL",
        chainId: "BTC",
      });
    });
  });
});
