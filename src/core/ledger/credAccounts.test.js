// @flow

import {NodeAddress} from "../graph";
import {_computeCredAccounts} from "./credAccounts";
import {Ledger} from "./ledger";
import {intervalSequence} from "../interval";

describe("core/ledger/credAccounts", () => {
  describe("_computeCredAccounts", () => {
    it("works in a simple case", () => {
      const ledger = new Ledger();
      ledger.createIdentity("USER", "sourcecred");
      const account = ledger.accounts()[0];
      const accountCred = [0, 1, 2];
      const userCred = [1, 0, 1];
      const userAddress = NodeAddress.empty;
      const info = new Map([
        [
          account.identity.address,
          {cred: accountCred, description: "irrelevant"},
        ],
        [userAddress, {cred: userCred, description: "Little lost user"}],
      ]);
      const intervals = intervalSequence([
        {startTimeMs: 121, endTimeMs: 123},
        {startTimeMs: 123, endTimeMs: 125},
        {startTimeMs: 125, endTimeMs: 127},
      ]);
      const expectedCredAccount = {cred: accountCred, account, totalCred: 3};
      const expectedUnclaimedAccount = {
        alias: {
          address: userAddress,
          description: "Little lost user",
        },
        cred: userCred,
        totalCred: 2,
      };
      const expectedData = {
        accounts: [expectedCredAccount],
        unclaimedAliases: [expectedUnclaimedAccount],
        intervals,
      };
      expect(_computeCredAccounts([account], info, intervals)).toEqual(
        expectedData
      );
    });
    it("errors if an alias address is in the cred scores", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "sourcecred");
      const alias = {address: NodeAddress.empty, description: "user"};
      ledger.addAlias(id, alias);

      const account = ledger.accounts()[0];
      const accountCred = [0, 1, 2];
      const userCred = [1, 0, 1];
      const info = new Map([
        [
          account.identity.address,
          {cred: accountCred, description: "irrelevant"},
        ],
        [alias.address, {cred: userCred, description: "irrelevant"}],
      ]);
      const intervals = intervalSequence([
        {startTimeMs: 121, endTimeMs: 123},
        {startTimeMs: 123, endTimeMs: 125},
        {startTimeMs: 125, endTimeMs: 127},
      ]);

      const thunk = () => _computeCredAccounts([account], info, intervals);
      expect(thunk).toThrowError(
        `cred sync error: alias ${NodeAddress.toString(
          NodeAddress.empty
        )} (aka irrelevant) included in Cred scores`
      );
    });
    it("errors if an account doesn't have cred info", () => {
      const ledger = new Ledger();
      ledger.createIdentity("USER", "sourcecred");

      const account = ledger.accounts()[0];
      const scores = new Map();
      const intervals = intervalSequence([
        {startTimeMs: 121, endTimeMs: 123},
        {startTimeMs: 123, endTimeMs: 125},
        {startTimeMs: 125, endTimeMs: 127},
      ]);

      const thunk = () => _computeCredAccounts([account], scores, intervals);
      expect(thunk).toThrowError(`cred sync error: no info for account`);
    });
  });
});
