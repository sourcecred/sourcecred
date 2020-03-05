// @flow

import {NodeAddress} from "../core/graph";
import {InMemoryLedger} from "./ledger";

describe("src/grain/ledger", () => {
  describe("InMemoryLedger", () => {
    const foo = NodeAddress.fromParts(["foo"]);
    const bar = NodeAddress.fromParts(["bar"]);
    const zod = NodeAddress.fromParts(["zod"]);

    it("works properly for an empty history", () => {
      const history = {events: [], aliases: new Map()};
      const ledger = new InMemoryLedger(history);
      expect(ledger.balances()).toEqual(new Map());
      expect(ledger.earnings()).toEqual(new Map());
      expect(ledger.canonicalAddress(foo)).toEqual(foo);
      expect(ledger.history()).toEqual(history);
    });
    it("correctly models some simple distributions", () => {
      const history = {
        aliases: new Map(),
        events: [
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: foo, amount: 10n, timestampMs: 0},
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: bar, amount: 99n, timestampMs: 1},
        ],
      };
      const ledger = new InMemoryLedger(history);
      const expected = new Map([
        // $ExpectFlowError
        [foo, 10n],
        // $ExpectFlowError
        [bar, 99n],
      ]);
      expect(ledger.balances()).toEqual(expected);
      expect(ledger.earnings()).toEqual(expected);
      expect(ledger.history()).toEqual(history);
    });
    it("correctly models a simple transfer", () => {
      const history = {
        aliases: new Map(),
        events: [
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: foo, amount: 10n, timestampMs: 0},
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: bar, amount: 99n, timestampMs: 1},
          {
            type: "TRANSFER",
            recipient: foo,
            sender: bar,
            // $ExpectFlowError
            amount: 50n,
            timestampMs: 2,
          },
        ],
      };
      const ledger = new InMemoryLedger(history);
      const expectedEarnings = new Map([
        // $ExpectFlowError
        [foo, 10n],
        // $ExpectFlowError
        [bar, 99n],
      ]);
      const expectedBalances = new Map([
        // $ExpectFlowError
        [foo, 60n],
        // $ExpectFlowError
        [bar, 49n],
      ]);
      expect(ledger.balances()).toEqual(expectedBalances);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.history()).toEqual(history);
    });
    it("throws an error if there are invalid transfers", () => {
      const history = {
        events: [
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: foo, amount: 10n, timestampMs: 0},
          {
            type: "TRANSFER",
            recipient: foo,
            sender: bar,
            // $ExpectFlowError
            amount: 50n,
            timestampMs: 2,
          },
        ],
        aliases: new Map(),
      };
      const fail = () => new InMemoryLedger(history);
      expect(fail).toThrowError("Invalid transfer (sender can't afford)");
    });
    it("aggregates balances and distributions across aliases", () => {
      const history = {
        aliases: new Map([[foo, zod]]),
        events: [
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: foo, amount: 10n, timestampMs: 0},
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: zod, amount: 10n, timestampMs: 0},
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: bar, amount: 99n, timestampMs: 1},
          {
            type: "TRANSFER",
            recipient: foo,
            sender: bar,
            // $ExpectFlowError
            amount: 50n,
            timestampMs: 2,
          },
        ],
      };
      const ledger = new InMemoryLedger(history);
      const expectedEarnings = new Map([
        // $ExpectFlowError
        [zod, 20n],
        // $ExpectFlowError
        [bar, 99n],
      ]);
      const expectedBalances = new Map([
        // $ExpectFlowError
        [zod, 70n],
        // $ExpectFlowError
        [bar, 49n],
      ]);
      expect(ledger.balances()).toEqual(expectedBalances);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.history()).toEqual(history);
      expect(ledger.canonicalAddress(foo)).toEqual(zod);
      expect(ledger.canonicalAddress(bar)).toEqual(bar);
      expect(ledger.canonicalAddress(zod)).toEqual(zod);
    });
    it("it can 'mix and match' transfers across aliases", () => {
      const history = {
        events: [
          // $ExpectFlowError
          {type: "DISTRIBUTION", recipient: foo, amount: 10n, timestampMs: 0},
          // Transfer is sent by zod, but grain was recieved as foo
          {
            type: "TRANSFER",
            sender: zod,
            recipient: bar,
            // $ExpectFlowError
            amount: 10n,
            timestampMs: 2,
          },
        ],
        aliases: new Map([[foo, zod]]),
      };
      const ledger = new InMemoryLedger(history);
      const expectedBalances = new Map([
        // $ExpectFlowError
        [zod, 0n],
        // $ExpectFlowError
        [bar, 10n],
      ]);
      expect(ledger.balances()).toEqual(expectedBalances);
      // $ExpectFlowError
      const expectedEarnings = new Map([[zod, 10n]]);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.history()).toEqual(history);
      expect(ledger.canonicalAddress(foo)).toEqual(zod);
      expect(ledger.canonicalAddress(bar)).toEqual(bar);
      expect(ledger.canonicalAddress(zod)).toEqual(zod);
    });
  });
});
