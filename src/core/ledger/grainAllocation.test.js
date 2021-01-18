// @flow

import * as G from "./grain";
import {random as randomUuid, parser as uuidParser} from "../../util/uuid";
import {
  computeAllocation,
  type AllocationIdentity,
  _validateAllocationBudget,
} from "./grainAllocation";
import {toDiscount} from "./policies/recent";

describe("core/ledger/grainAllocation", () => {
  // concise helper for grain from a string
  const g = (x: string) => G.fromString(x);
  // concise helper for grain from a number
  const ng = (x: number) => g(x.toString());
  // concise helper for an allocation identity
  function aid(paid: number, cred: $ReadOnlyArray<number>): AllocationIdentity {
    return {id: randomUuid(), paid: ng(paid), cred};
  }
  const immediate = (n: number) => ({policyType: "IMMEDIATE", budget: ng(n)});
  const recent = (n: number, discount: number) => ({
    policyType: "RECENT",
    budget: ng(n),
    discount: toDiscount(discount),
  });
  const balanced = (n: number) => ({policyType: "BALANCED", budget: ng(n)});
  const underpaid = (n: number, threshold: number, exponent: number) => ({
    policyType: "UNDERPAID",
    budget: ng(n),
    threshold: ng(threshold),
    exponent,
  });

  describe("computeAllocation", () => {
    describe("validation", () => {
      it("errors if there are no identities", () => {
        const thunk = () => computeAllocation(immediate(5), []);
        expect(thunk).toThrowError("must have at least one identity");
      });
      it("errors if the budget is negative", () => {
        const id = aid(5, [1]);
        const thunk = () => computeAllocation(immediate(-5), [id]);
        expect(thunk).toThrowError("invalid budget");
      });
      it("errors if the total cred is zero", () => {
        const thunk = () => computeAllocation(immediate(5), [aid(0, [0])]);
        expect(thunk).toThrowError("cred is zero");
      });
      it("errors if there's negative paid", () => {
        const thunk = () => computeAllocation(immediate(5), [aid(-1, [0])]);
        expect(thunk).toThrowError("negative paid");
      });
      it("errors if there's NaN or Infinity in Cred", () => {
        const thunk = () => computeAllocation(immediate(5), [aid(0, [NaN])]);
        expect(thunk).toThrowError("invalid cred");
      });
      it("errors if there's inconsistent Cred lengths", () => {
        const i1 = aid(0, [1]);
        const i2 = aid(0, [1, 2]);
        const thunk = () => computeAllocation(immediate(5), [i1, i2]);
        expect(thunk).toThrowError("inconsistent cred length");
      });
      it("errors if the receipts don't match the budget", () => {
        const badAllocation = {
          policy: immediate(5),
          id: randomUuid(),
          receipts: [],
        };
        const thunk = () => _validateAllocationBudget(badAllocation);
        expect(thunk).toThrow("has budget of 5 but distributed 0");
      });
    });

    describe("immediate policy", () => {
      it("splits based on just most recent cred", () => {
        const policy = immediate(10);
        const i1 = aid(100, [10, 2]);
        const i2 = aid(0, [0, 3]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(4)},
          {id: i2.id, amount: ng(6)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("handles 0 budget correctly", () => {
        const policy = immediate(0);
        const i1 = aid(3, [1, 1]);
        const i2 = aid(0, [3, 0]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(0)},
          {id: i2.id, amount: ng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
    });

    describe("recent policy", () => {
      it("splits based on discounted cred", () => {
        const policy = recent(100, 0.1);
        const i1 = aid(0, [0, 0, 100]);
        const i2 = aid(100, [100, 0, 0]);
        const i3 = aid(0, [100, 0, 0]);
        const allocation = computeAllocation(policy, [i1, i2, i3]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(38)},
          {id: i2.id, amount: ng(31)},
          {id: i3.id, amount: ng(31)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("is not influenced by grain paid", () => {
        const policy = recent(100, 0.1);
        const i1 = aid(0, [100, 100, 100]);
        const i2 = aid(100, [100, 100, 100]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(50)},
          {id: i2.id, amount: ng(50)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("handles full discount correctly", () => {
        const policy = recent(100, 1);
        const i1 = aid(50, [0, 50, 0]);
        const i2 = aid(0, [0, 10, 100]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(0)},
          {id: i2.id, amount: ng(100)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("handles 0 budget correctly", () => {
        const policy = recent(0, 0.1);
        const i1 = aid(50, [100, 50, 10]);
        const i2 = aid(0, [0, 10, 100]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(0)},
          {id: i2.id, amount: ng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
    });

    describe("balanced policy", () => {
      it("splits based on lifetime Cred when there's no paid amounts", () => {
        const policy = balanced(100);
        const i1 = aid(0, [1, 1]);
        const i2 = aid(0, [3, 0]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(40)},
          {id: i2.id, amount: ng(60)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("takes past payment into account", () => {
        const policy = balanced(20);
        const i1 = aid(0, [1, 1]);
        const i2 = aid(30, [3, 0]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(20)},
          {id: i2.id, amount: ng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("handles 0 budget correctly", () => {
        const policy = balanced(0);
        const i1 = aid(30, [1, 1]);
        const i2 = aid(0, [3, 0]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(0)},
          {id: i2.id, amount: ng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
    });

    describe("underpaid policy", () => {
      it("errors on negative threshold", () => {
        const policy = underpaid(100, -1, 1);
        const i1 = aid(0, [1, 1, 10]);
        const i2 = aid(0, [3, 0, 20]);

        expect(() => computeAllocation(policy, [i1, i2])).toThrowError(
          "threshold must be >= 0"
        );
      });

      it("errors if exponent below range (0, 1]", () => {
        const policy = underpaid(100, 0, 0);
        const i1 = aid(0, [1, 1, 10]);
        const i2 = aid(0, [3, 0, 20]);

        expect(() => computeAllocation(policy, [i1, i2])).toThrowError(
          "exponent must be in range"
        );
      });

      it("errors if exponent above range (0, 1]", () => {
        const policy = underpaid(100, 0, 1.1);
        const i1 = aid(0, [1, 1, 10]);
        const i2 = aid(0, [3, 0, 20]);

        expect(() => computeAllocation(policy, [i1, i2])).toThrowError(
          "exponent must be in range"
        );
      });

      it("equivalent to balanced with threshold 0 and exponent 1", () => {
        const policy1 = balanced(100);
        const policy2 = underpaid(100, 0, 1);
        const i1 = aid(0, [1, 1, 10]);
        const i2 = aid(0, [3, 0, 20]);
        const allocation1 = computeAllocation(policy1, [i1, i2]);
        const allocation2 = computeAllocation(policy2, [i1, i2]);
        expect(allocation1.receipts).toEqual(allocation2.receipts);
      });

      it("splits based on quadratic lifetime Cred when there's no paid amounts and zero threshold", () => {
        const policy = underpaid(100, 0, 0.5);
        const i1 = aid(0, [40, 9]);
        const i2 = aid(0, [9, 0]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(70)},
          {id: i2.id, amount: ng(30)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("takes past payment into account checking threshold", () => {
        const policy = underpaid(100, 30, 0.5);
        const i1 = aid(0, [0, 45]);
        const i2 = aid(40, [55, 0]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(100)},
          {id: i2.id, amount: ng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("handles 0 budget correctly", () => {
        const policy = underpaid(0, 100, 0.5);
        const i1 = aid(30, [1, 1]);
        const i2 = aid(0, [3, 0]);
        const allocation = computeAllocation(policy, [i1, i2]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(0)},
          {id: i2.id, amount: ng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });

      it("drops users below threshold from allocation", () => {
        const policy = underpaid(150, 31, 1);
        const i1 = aid(0, [80, 0]);
        const i2 = aid(0, [0, 40]);
        const i3 = aid(0, [0, 30]);
        const allocation = computeAllocation(policy, [i1, i2, i3]);
        const expectedReceipts = [
          {id: i1.id, amount: ng(100)},
          {id: i2.id, amount: ng(50)},
          {id: i3.id, amount: ng(0)},
        ];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
    });

    describe("special policy", () => {
      it("distributes the budget to the stated recipient", () => {
        const i1 = aid(0, [1]);
        const policy = {
          policyType: "SPECIAL",
          budget: ng(100),
          memo: "something",
          recipient: i1.id,
        };
        const allocation = computeAllocation(policy, [i1]);
        const expectedReceipts = [{id: i1.id, amount: ng(100)}];
        const expectedAllocation = {
          receipts: expectedReceipts,
          id: uuidParser.parseOrThrow(allocation.id),
          policy,
        };
        expect(allocation).toEqual(expectedAllocation);
      });
      it("errors if the recipient is not available", () => {
        const {id} = aid(0, [1]);
        const other = aid(0, [1]);
        const policy = {
          policyType: "SPECIAL",
          budget: ng(100),
          memo: "something",
          recipient: id,
        };
        const thunk = () => computeAllocation(policy, [other]);
        expect(thunk).toThrowError("no active grain account for identity");
      });
    });
  });
});
