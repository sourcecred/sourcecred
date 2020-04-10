// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress} from "../core/graph";
import {InMemoryLedger} from "./ledger";
import {fromFloat} from "./grain";

describe("src/grain/ledger", () => {
  describe("InMemoryLedger", () => {
    const foo = NodeAddress.fromParts(["foo"]);
    const bar = NodeAddress.fromParts(["bar"]);

    it("works properly for an empty history", () => {
      const ledger = new InMemoryLedger([]);
      expect(ledger.balances()).toEqual(new Map());
      expect(ledger.earnings()).toEqual(new Map());
      expect(ledger.events()).toEqual([]);
    });
    it("correctly models a simple harvest", () => {
      const events = [
        {
          type: "HARVEST",
          version: "1",
          receipts: [
            {address: foo, amount: fromFloat(10)},
            {address: bar, amount: fromFloat(99)},
          ],
          timestampMs: 0,
        },
      ];
      const ledger = new InMemoryLedger(events);
      const expected = new Map([
        [foo, fromFloat(10)],
        [bar, fromFloat(99)],
      ]);
      expect(ledger.balances()).toEqual(expected);
      expect(ledger.earnings()).toEqual(expected);
    });
    it("correctly models a simple transfer", () => {
      const events = [
        {
          type: "HARVEST",
          version: "1",
          receipts: [
            {address: foo, amount: fromFloat(10)},
            {address: bar, amount: fromFloat(99)},
          ],
          timestampMs: 0,
        },
        {
          type: "TRANSFER",
          version: "1",
          recipient: foo,
          sender: bar,
          amount: fromFloat(50),
          timestampMs: 2,
        },
      ];
      const ledger = new InMemoryLedger(events);
      const expectedEarnings = new Map([
        [foo, fromFloat(10)],
        [bar, fromFloat(99)],
      ]);
      const expectedBalances = new Map([
        [foo, fromFloat(60)],
        [bar, fromFloat(49)],
      ]);
      expect(ledger.balances()).toEqual(expectedBalances);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.events()).toEqual(events);
    });
    it("supports a self-transfer", () => {
      const events = [
        {
          type: "HARVEST",
          version: "1",
          receipts: [{address: foo, amount: fromFloat(10)}],
          timestampMs: 0,
        },
        {
          type: "TRANSFER",
          version: "1",
          recipient: foo,
          sender: foo,
          amount: fromFloat(5),
          timestampMs: 2,
        },
      ];
      const ledger = new InMemoryLedger(events);
      const expectedEarnings = new Map([[foo, fromFloat(10)]]);
      const expectedBalances = new Map([[foo, fromFloat(10)]]);
      expect(ledger.balances()).toEqual(expectedBalances);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.events()).toEqual(events);
    });

    describe("errors on", () => {
      it("unaffordable transfers", () => {
        const events = [
          {
            type: "HARVEST",
            version: "1",
            receipts: [
              {
                address: foo,
                amount: fromFloat(10),
              },
            ],
            timestampMs: 0,
          },
          {
            type: "TRANSFER",
            version: "1",
            recipient: foo,
            sender: bar,
            amount: fromFloat(50),
            timestampMs: 2,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Invalid transfer (sender can't afford)");
      });
      it("unaffordable self-transfers", () => {
        const events = [
          {
            type: "TRANSFER",
            version: "1",
            recipient: foo,
            sender: foo,
            amount: fromFloat(50),
            timestampMs: 2,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Invalid transfer (sender can't afford)");
      });
      it("harvests with unsupported versions", () => {
        const events = [
          {
            type: "HARVEST",
            version: "x",
            receipts: [{address: foo, amount: fromFloat(10)}],
            timestampMs: 0,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported harvest version: x");
      });
      it("transfers with unsupported version", () => {
        const events = [
          {
            type: "HARVEST",
            version: "1",
            receipts: [{address: foo, amount: fromFloat(10)}],
            timestampMs: 0,
          },
          {
            type: "TRANSFER",
            version: "x",
            recipient: foo,
            sender: bar,
            amount: fromFloat(10),
            timestampMs: 2,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported transfer version: x");
      });
      it("unsupported event types", () => {
        const events = [
          {
            type: "FOO",
            version: "1",
            recipient: foo,
            amount: fromFloat(10),
            timestampMs: 0,
          },
        ];
        // $ExpectFlowError
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported event type: FOO");
      });
    });
  });
});
