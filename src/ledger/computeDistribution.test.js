// @flow

import {Ledger} from "./ledger";
import {NodeAddress} from "../core/graph";
import {_allocationIdentities} from "./computeDistribution";
import * as G from "./grain";
import {intervalSequence} from "../core/interval";

describe("ledger/computeDistribution", () => {
  describe("_allocationIdentities", () => {
    it("only includes active GrainAccounts", () => {
      const ledger = new Ledger();
      const active = ledger.createIdentity("USER", "active");
      ledger._allocateGrain(active, G.fromString("1"));
      ledger.activate(active);
      ledger.createIdentity("USER", "inactive");
      const accounts = ledger.accounts().map((a) => ({
        account: a,
        cred: [1, 2, 3],
        totalCred: 6,
      }));
      const unclaimedAliases = [
        {
          alias: {
            address: NodeAddress.empty,
            description: "irrelevant",
          },
          cred: [4, 5, 6],
          totalCred: 15,
        },
      ];
      const intervals = intervalSequence([
        {startTimeMs: 121, endTimeMs: 123},
        {startTimeMs: 123, endTimeMs: 125},
        {startTimeMs: 125, endTimeMs: 127},
      ]);
      const accountsData = {
        intervals,
        accounts,
        unclaimedAliases,
      };
      const expectedAllocationIdentites = [
        {id: active, cred: [1, 2, 3], paid: "1"},
      ];
      expect(_allocationIdentities(accountsData, 999)).toEqual(
        expectedAllocationIdentites
      );
    });
    it("time slices the cred as expected", () => {
      const ledger = new Ledger();
      const active = ledger.createIdentity("USER", "active");
      ledger._allocateGrain(active, G.fromString("1"));
      ledger.activate(active);
      ledger.createIdentity("USER", "inactive");
      const accounts = ledger.accounts().map((a) => ({
        account: a,
        cred: [1, 2, 3],
        totalCred: 6,
      }));
      const intervals = intervalSequence([
        {startTimeMs: 121, endTimeMs: 123},
        {startTimeMs: 123, endTimeMs: 125},
        {startTimeMs: 125, endTimeMs: 127},
      ]);
      const accountsData = {
        intervals,
        accounts,
        unclaimedAliases: [],
      };
      const expectedAllocationIdentites = [{id: active, cred: [1], paid: "1"}];
      // Only includes the first time slice, b.c. it's the only one that is completed
      expect(_allocationIdentities(accountsData, 123)).toEqual(
        expectedAllocationIdentites
      );
    });
  });
});
