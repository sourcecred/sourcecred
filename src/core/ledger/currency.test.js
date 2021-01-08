// @flow

import {parseEvmChainId} from "./currency";

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
});
