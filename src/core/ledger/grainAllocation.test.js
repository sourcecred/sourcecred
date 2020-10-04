// @flow

import {
  computeAllocation,
  type AllocationIdentity,
  _validateAllocationBudget,
} from "./grainAllocation";
import * as G from "./grain";
import {random as randomUuid, parser as uuidParser} from "../../util/uuid";

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
  const balanced = (n: number) => ({policyType: "BALANCED", budget: ng(n)});

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
