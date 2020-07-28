// @flow

import {NodeAddress} from "../core/graph";
import {_computeCredAccounts} from "./credAccounts";
import {Ledger} from "../ledger/ledger";

describe("ledger/credAccounts", () => {
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
      const intervalEndpoints = [123, 125, 127];
      const expectedCredAccount = {cred: accountCred, account, totalCred: 3};
      const expectedUnclaimedAccount = {
        cred: userCred,
        totalCred: 2,
        address: userAddress,
        description: "Little lost user",
      };
      const expectedData = {
        accounts: [expectedCredAccount],
        unclaimedAliases: [expectedUnclaimedAccount],
        intervalEndpoints,
      };
      expect(_computeCredAccounts([account], info, intervalEndpoints)).toEqual(
        expectedData
      );
    });
    it("errors if an alias address is in the cred scores", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "sourcecred");
      const userAddress = NodeAddress.empty;
      ledger.addAlias(id, userAddress);

      const account = ledger.accounts()[0];
      const accountCred = [0, 1, 2];
      const userCred = [1, 0, 1];
      const info = new Map([
        [
          account.identity.address,
          {cred: accountCred, description: "irrelevant"},
        ],
        [userAddress, {cred: userCred, description: "irrelevant"}],
      ]);
      const intervalEndpoints = [123, 125, 127];

      const thunk = () =>
        _computeCredAccounts([account], info, intervalEndpoints);
      expect(thunk).toThrowError(
        `cred sync error: alias ${NodeAddress.toString(
          userAddress
        )} included in Cred scores`
      );
    });
    it("errors if an account doesn't have cred info", () => {
      const ledger = new Ledger();
      ledger.createIdentity("USER", "sourcecred");

      const account = ledger.accounts()[0];
      const scores = new Map();
      const intervalEndpoints = [123, 125, 127];

      const thunk = () =>
        _computeCredAccounts([account], scores, intervalEndpoints);
      expect(thunk).toThrowError(`cred sync error: no info for account`);
    });
  });
});
