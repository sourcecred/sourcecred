// @flow

import {Ledger} from "./ledger";
import {NodeAddress} from "../core/graph";
import {_allocationIdentities} from "./computeDistribution";
import * as G from "./grain";

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
      const accountsData = {
        intervalEndpoints: [123, 125, 127],
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
      const accountsData = {
        intervalEndpoints: [123, 125, 127],
        accounts,
        unclaimedAliases: [],
      };
      const expectedAllocationIdentites = [{id: active, cred: [1], paid: "1"}];
      expect(_allocationIdentities(accountsData, 123)).toEqual(
        expectedAllocationIdentites
      );
    });
  });
});
