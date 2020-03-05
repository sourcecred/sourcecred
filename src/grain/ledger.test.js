// @flow

import {NodeAddress, type NodeAddressT} from "../core/graph";
import {InMemoryLedger} from "./ledger";
import {fromApproximateFloat, ZERO, type Grain} from "./grain";
import {type DistributionV1, type DistributionStrategy} from "./distribution";

describe("src/grain/ledger", () => {
  function mockDistribution(
    timestampMs: number,
    recipients: [NodeAddressT, number][]
  ): DistributionV1 {
    const receipts = recipients.map(([address, amount]) => ({
      address,
      amount: fromApproximateFloat(amount),
    }));
    let amt = ZERO;
    for (const {amount} of receipts) {
      amt += amount;
    }
    const strategy: DistributionStrategy = {
      type: "IMMEDIATE",
      version: 1,
      amount: amt,
    };
    return {type: "DISTRIBUTION", version: 1, receipts, strategy, timestampMs};
  }

  function mockTransfer(
    timestampMs: number,
    from: NodeAddressT,
    to: NodeAddressT,
    amount: number
  ) {
    return {
      type: "TRANSFER",
      version: 1,
      recipient: to,
      sender: from,
      amount: fromApproximateFloat(amount),
      timestampMs,
    };
  }

  function grainMap(
    recipients: [NodeAddressT, number][]
  ): Map<NodeAddressT, Grain> {
    return new Map(
      recipients.map(([address, amount]) => [
        address,
        fromApproximateFloat(amount),
      ])
    );
  }
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
        mockDistribution(0, [
          [foo, 10],
          [bar, 99],
        ]),
      ];
      const ledger = new InMemoryLedger(events);
      const expected = grainMap([
        [foo, 10],
        [bar, 99],
      ]);
      expect(ledger.balances()).toEqual(expected);
      expect(ledger.earnings()).toEqual(expected);
      expect(ledger.events()).toEqual(events);
    });
    it("correctly models a simple transfer", () => {
      const events = [
        mockDistribution(0, [
          [foo, 10],
          [bar, 99],
        ]),
        mockTransfer(2, bar, foo, 50),
      ];
      const ledger = new InMemoryLedger(events);
      const expectedEarnings = grainMap([
        [foo, 10],
        [bar, 99],
      ]);
      const expectedBalances = grainMap([
        [foo, 60],
        [bar, 49],
      ]);
      expect(ledger.balances()).toEqual(expectedBalances);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.events()).toEqual(events);
    });
    it("supports a self-transfer", () => {
      const events = [
        mockDistribution(0, [[foo, 10]]),
        mockTransfer(1, foo, foo, 5),
      ];
      const ledger = new InMemoryLedger(events);
      const expectedEarnings = grainMap([[foo, 10]]);
      const expectedBalances = grainMap([[foo, 10]]);
      expect(ledger.balances()).toEqual(expectedBalances);
      expect(ledger.earnings()).toEqual(expectedEarnings);
      expect(ledger.events()).toEqual(events);
    });
    it("events returns an independent copy", () => {
      const ledger = new InMemoryLedger([]);
      // $ExpectFlowError
      ledger.events().push(33);
      expect(ledger.events()).toHaveLength(0);
    });

    describe("errors on", () => {
      it("unaffordable transfers", () => {
        const events = [
          mockDistribution(0, [[foo, 10]]),
          mockTransfer(1, bar, foo, 5),
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Invalid transfer (sender can't afford)");
      });
      it("unaffordable self-transfers", () => {
        const events = [
          mockDistribution(0, [[foo, 10]]),
          mockTransfer(1, foo, foo, 11),
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Invalid transfer (sender can't afford)");
      });
      it("distributions with unsupported versions", () => {
        const events = [
          {
            type: "DISTRIBUTION",
            version: 999,
            timestampMs: 0,
          },
        ];
        // $ExpectFlowError
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported distribution version: 99");
      });
      it("transfers with unsupported version", () => {
        const events = [
          mockDistribution(0, [[foo, 99]]),
          {
            type: "TRANSFER",
            version: 999,
            recipient: foo,
            sender: foo,
            amount: ZERO,
            timestampMs: 2,
          },
        ];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported transfer version: 999");
      });
      it("unsupported event types", () => {
        const events = [
          {
            type: "FOO",
            version: 999,
            timestampMs: 0,
          },
        ];
        // $ExpectFlowError
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("Unsupported event type: FOO");
      });
      it("out-of-order events", () => {
        const events = [mockDistribution(5, []), mockDistribution(4, [])];
        const fail = () => new InMemoryLedger(events);
        expect(fail).toThrowError("event timestamps out of order");
      });
    });
  });
});
