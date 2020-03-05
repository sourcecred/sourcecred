// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress} from "../core/graph";
import {InMemoryLedger, EventOrder, EventSort} from "./ledger";

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
    it("correctly models some simple distributions", () => {
      const events = [
        {
          type: "DISTRIBUTION",
          version: "0.1.0",
          recipient: foo,
          // $ExpectFlowError
          amount: 10n,
          timestampMs: 0,
        },
        {
          type: "DISTRIBUTION",
          version: "0.1.0",
          recipient: bar,
          // $ExpectFlowError
          amount: 99n,
          timestampMs: 1,
        },
      ];
      const ledger = new InMemoryLedger(events);
      const expected = new Map([
        // $ExpectFlowError
        [foo, 10n],
        // $ExpectFlowError
        [bar, 99n],
      ]);
      expect(ledger.balances()).toEqual(expected);
      expect(ledger.earnings()).toEqual(expected);
    });
    it("correctly models a simple transfer", () => {
      const events = [
        {
          type: "DISTRIBUTION",
          version: "0.1.0",
          recipient: foo,
          // $ExpectFlowError
          amount: 10n,
          timestampMs: 0,
        },
        {
          type: "DISTRIBUTION",
          version: "0.1.0",
          recipient: bar,
          // $ExpectFlowError
          amount: 99n,
          timestampMs: 1,
        },
        {
          type: "TRANSFER",
          version: "0.1.0",
          recipient: foo,
          sender: bar,
          // $ExpectFlowError
          amount: 50n,
          timestampMs: 2,
        },
      ];
      const ledger = new InMemoryLedger(events);
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
      expect(ledger.events()).toEqual(events);
    });
    it("supports a self-transfer", () => {
      const events = [
        {
          type: "DISTRIBUTION",
          version: "0.1.0",
          recipient: foo,
          // $ExpectFlowError
          amount: 10n,
          timestampMs: 0,
        },
        {
          type: "TRANSFER",
          version: "0.1.0",
          recipient: foo,
          sender: foo,
          // $ExpectFlowError
          amount: 5n,
          timestampMs: 2,
        },
      ];
      const ledger = new InMemoryLedger(events);
      const expectedEarnings = new Map([
        // $ExpectFlowError
        [foo, 10n],
      ]);
      const expectedBalances = new Map([
        // $ExpectFlowError
        [foo, 10n],
      ]);
      expect(ledger.balances()).toEqual(expectedBalances);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.events()).toEqual(events);
    });

    describe("events iterator", () => {
      const dFoo = {
        type: "DISTRIBUTION",
        version: "0.1.0",
        recipient: foo,
        // $ExpectFlowError
        amount: 10n,
        timestampMs: 0,
      };
      const dBar = {
        type: "DISTRIBUTION",
        version: "0.1.0",
        recipient: bar,
        // $ExpectFlowError
        amount: 99n,
        timestampMs: 1,
      };
      const tx = {
        type: "TRANSFER",
        version: "0.1.0",
        recipient: foo,
        sender: bar,
        // $ExpectFlowError
        amount: 50n,
        timestampMs: 2,
      };
      const events = deepFreeze([dFoo, dBar, tx]);
      it("can filter by address", () => {
        const ledger = new InMemoryLedger(events);
        const fooOnly = ledger.events({address: foo});
        expect(fooOnly).toEqual([dFoo, tx]);
        const barOnly = ledger.events({address: bar});
        expect(barOnly).toEqual([dBar, tx]);
        const empty = ledger.events({address: NodeAddress.empty});
        // no prefix matching
        expect(empty).toEqual([]);
      });
      it("can sort by timestamp ascending", () => {
        const ledger = new InMemoryLedger(events);
        expect(
          ledger.events({
            eventOrder: EventOrder.ASCENDING,
            eventSort: EventSort.TIMESTAMP,
          })
        ).toEqual(events);
      });
      it("can sort by timestamp descending", () => {
        const ledger = new InMemoryLedger(events);
        expect(
          ledger.events({
            eventOrder: EventOrder.DESCENDING,
            eventSort: EventSort.TIMESTAMP,
          })
        ).toEqual([tx, dBar, dFoo]);
      });
      it("can sort by amount ascending", () => {
        const ledger = new InMemoryLedger(events);
        expect(
          ledger.events({
            eventOrder: EventOrder.ASCENDING,
            eventSort: EventSort.AMOUNT,
          })
        ).toEqual([dFoo, tx, dBar]);
      });
      it("can sort by amount descending", () => {
        const ledger = new InMemoryLedger(events);
        expect(
          ledger.events({
            eventOrder: EventOrder.DESCENDING,
            eventSort: EventSort.AMOUNT,
          })
        ).toEqual([dBar, tx, dFoo]);
      });
      it("maintains original order for events with equal timestamps", () => {
        const e1 = {
          type: "DISTRIBUTION",
          version: "0.1.0",
          recipient: foo,
          // $ExpectFlowError
          amount: 10n,
          timestampMs: 0,
        };
        const e2 = {
          type: "TRANSFER",
          version: "0.1.0",
          recipient: bar,
          // $ExpectFlowError
          amount: 10n,
          sender: foo,
          timestampMs: 0,
        };
        const ledger = new InMemoryLedger([e1, e2]);
        expect(
          ledger.events({
            eventOrder: EventOrder.ASCENDING,
            eventSort: EventSort.TIMESTAMP,
          })
        ).toEqual([e1, e2]);
        expect(
          ledger.events({
            eventOrder: EventOrder.DESCENDING,
            eventSort: EventSort.TIMESTAMP,
          })
        ).toEqual([e2, e1]);
      });
    });

    describe("errors on", () => {
      it("unaffordable transfers", () => {
        const events = [
          {
            type: "DISTRIBUTION",
            version: "0.1.0",
            recipient: foo,
            // $ExpectFlowError
            amount: 10n,
            timestampMs: 0,
          },
          {
            type: "TRANSFER",
            version: "0.1.0",
            recipient: foo,
            sender: bar,
            // $ExpectFlowError
            amount: 50n,
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
            version: "0.1.0",
            recipient: foo,
            sender: foo,
            // $ExpectFlowError
            amount: 50n,
            timestampMs: 2,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Invalid transfer (sender can't afford)");
      });
      it("distributions with unsupported versions", () => {
        const events = [
          {
            type: "DISTRIBUTION",
            version: "0.x.0",
            recipient: foo,
            // $ExpectFlowError
            amount: 10n,
            timestampMs: 0,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported distribution version: 0.x.0");
      });
      it("transfers with unsupported version", () => {
        const events = [
          {
            type: "DISTRIBUTION",
            version: "0.1.0",
            recipient: foo,
            // $ExpectFlowError
            amount: 10n,
            timestampMs: 0,
          },
          {
            type: "TRANSFER",
            version: "0.x.0",
            recipient: foo,
            sender: bar,
            // $ExpectFlowError
            amount: 10n,
            timestampMs: 2,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported transfer version: 0.x.0");
      });
      it("unsupported event types", () => {
        const events = [
          {
            type: "FOO",
            version: "0.1.0",
            recipient: foo,
            // $ExpectFlowError
            amount: 10n,
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
