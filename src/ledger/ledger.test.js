// @flow

import cloneDeep from "lodash.clonedeep";
import {NodeAddress} from "../core/graph";
import {Ledger, parser} from "./ledger";
import {newIdentity} from "./identity";
import * as G from "./grain";
import * as uuid from "../util/uuid"; // for spy purposes
import * as NullUtil from "../util/null";

describe("ledger/ledger", () => {
  // Helper for constructing Grain values.
  const g = (s) => G.fromString(s);
  function setFakeDate(ts: number) {
    jest.spyOn(global.Date, "now").mockImplementationOnce(() => ts);
  }

  const id1 = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
  const id2 = uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ");
  const id3 = uuid.fromString("EpbMqV0HmcolKvpXTwSddA");
  function setNextUuid(x: uuid.Uuid) {
    jest.spyOn(uuid, "random").mockImplementationOnce(() => x);
  }

  // Verify that a method fails, throwing an error, without mutating the ledger.
  function failsWithoutMutation(
    ledger: Ledger,
    operation: (Ledger) => any,
    message: string
  ) {
    const copy = cloneDeep(ledger);
    expect(() => operation(ledger)).toThrow(message);
    expect(copy).toEqual(ledger);
  }

  function ledgerWithIdentities() {
    const ledger = new Ledger();
    setNextUuid(id1);
    setFakeDate(1);
    ledger.createIdentity("USER", "steven");
    setNextUuid(id2);
    setFakeDate(2);
    ledger.createIdentity("ORGANIZATION", "crystal-gems");
    return ledger;
  }

  const a1 = NodeAddress.fromParts(["a1"]);
  const a2 = NodeAddress.fromParts(["a2"]);

  describe("identity updates", () => {
    describe("createIdentity", () => {
      it("works", () => {
        setFakeDate(123);
        const l = new Ledger();
        const id = l.createIdentity("USER", "foo");
        const foo = l.identityById(id);
        expect(l.identities()).toEqual([foo]);
        expect(l.accounts()).toEqual([{id, balance: G.ZERO, paid: G.ZERO}]);
        expect(l.eventLog()).toEqual([
          {
            ledgerTimestamp: 123,
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              identity: foo,
              version: "1",
            },
          },
        ]);
      });
      it("throws an error if the identityName is invalid", () => {
        const ledger = new Ledger();
        const thunk = () => ledger.createIdentity("USER", "foo bar");
        failsWithoutMutation(ledger, thunk, "invalid identityName");
        expect(ledger.identities()).toEqual([]);
      });
      it("throws an error if the identityName is taken", () => {
        const ledger = new Ledger();
        ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.createIdentity("USER", "foo");
        failsWithoutMutation(ledger, thunk, "identityName already taken");
      });
      it("throws an error given an identity with aliases", () => {
        const ledger = new Ledger();
        let identity = newIdentity("USER", "foo");
        identity = {...identity, aliases: [NodeAddress.empty]};
        const action = {type: "CREATE_IDENTITY", identity, version: "1"};
        const thunk = () => ledger._createIdentity(action);
        expect(thunk).toThrowError("new identities may not have aliases");
      });
    });

    describe("renameIdentity", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("USER", "foo");
        const initialIdentity = NullUtil.get(ledger.identityById(id));
        setFakeDate(1);
        ledger.renameIdentity(id, "bar");
        const identity = ledger.identityById(id);

        expect(identity).toEqual({
          id,
          name: "bar",
          subtype: "USER",
          address: initialIdentity.address,
          aliases: [],
        });
        expect(ledger.identityByIdentityName("bar")).toEqual(identity);
        expect(ledger.identityByIdentityName("foo")).toEqual(undefined);
        expect(ledger.identities()).toEqual([identity]);

        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 0,
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              version: "1",
              identity: initialIdentity,
            },
          },
          {
            ledgerTimestamp: 1,
            version: "1",
            action: {
              type: "RENAME_IDENTITY",
              version: "1",
              newName: "bar",
              identityId: id,
            },
          },
        ]);
      });
      it("fails if the identity already has that name", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.renameIdentity(id, "foo");
        failsWithoutMutation(
          ledger,
          thunk,
          "renameIdentity: identity already has name"
        );
      });
      it("fails on nonexistent identity id", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.renameIdentity(uuid.random(), "bar"),
          "renameIdentity: no identity matches id"
        );
      });
      it("fails on identityName conflict", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        ledger.createIdentity("USER", "bar");
        const thunk = () => ledger.renameIdentity(fooId, "bar");
        failsWithoutMutation(
          ledger,
          thunk,
          "renameIdentity: conflict on identityName bar"
        );
      });
      it("fails on invalid identityName", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.renameIdentity(fooId, "foo bar");
        failsWithoutMutation(ledger, thunk, "invalid identityName");
      });
    });

    describe("addAlias", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("USER", "foo");
        setFakeDate(1);
        ledger.addAlias(id, a1);
        const identity = NullUtil.get(ledger.identityById(id));
        expect(identity.aliases).toEqual([a1]);
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 0,
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              version: "1",
              identity: expect.anything(),
            },
          },
          {
            ledgerTimestamp: 1,
            version: "1",
            action: {
              type: "ADD_ALIAS",
              version: "1",
              identityId: id,
              alias: a1,
            },
          },
        ]);
      });
      it("errors if there's no matching identity", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.addAlias(uuid.random(), a1),
          "addAlias: no matching identityId"
        );
      });
      it("throws an error if the identity already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        ledger.addAlias(id, a1);
        const thunk = () => ledger.addAlias(id, a1);
        failsWithoutMutation(ledger, thunk, "identity already has alias");
      });
      it("errors if the address is another identity's alias", () => {
        const ledger = new Ledger();
        const id1 = ledger.createIdentity("USER", "foo");
        const id2 = ledger.createIdentity("USER", "bar");
        ledger.addAlias(id1, a1);
        const thunk = () => ledger.addAlias(id2, a1);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(a1)} already bound`
        );
      });
      it("errors if the address is the identity's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const identity = NullUtil.get(ledger.identityById(id));
        const thunk = () => ledger.addAlias(id, identity.address);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(
            identity.address
          )} already bound`
        );
      });
      it("errors if the address is another identity's innate address", () => {
        const ledger = new Ledger();
        const id1 = ledger.createIdentity("USER", "foo");
        const identity1 = NullUtil.get(ledger.identityById(id1));
        const id2 = ledger.createIdentity("USER", "bar");
        const thunk = () => ledger.addAlias(id2, identity1.address);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(
            identity1.address
          )} already bound`
        );
      });
    });
    describe("removeAlias", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("USER", "foo");
        setFakeDate(1);
        ledger.addAlias(id, a1);
        setFakeDate(2);
        ledger.removeAlias(id, a1, 0);
        const identity = NullUtil.get(ledger.identityById(id));
        expect(identity.aliases).toEqual([]);
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 0,
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              version: "1",
              identity: expect.anything(),
            },
          },
          {
            ledgerTimestamp: 1,
            version: "1",
            action: {
              type: "ADD_ALIAS",
              version: "1",
              identityId: id,
              alias: a1,
            },
          },
          {
            ledgerTimestamp: 2,
            version: "1",
            action: {
              type: "REMOVE_ALIAS",
              version: "1",
              identityId: id,
              alias: a1,
              retroactivePaid: "0",
            },
          },
        ]);
      });
      it("errors if there's no matching identity", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.removeAlias(uuid.random(), a1, 0),
          "removeAlias: no identity with id"
        );
      });
      it("throws an error if the identity doesn't already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const thunk = () => ledger.removeAlias(id, a1, 0);
        failsWithoutMutation(ledger, thunk, "identity does not have alias");
      });
      it("errors if the address is the identity's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("USER", "foo");
        const identity = NullUtil.get(ledger.identityById(id));
        const thunk = () => ledger.removeAlias(id, identity.address, 0);
        failsWithoutMutation(
          ledger,
          thunk,
          `removeAlias: cannot remove identity's innate address`
        );
      });
      it("frees the alias to be re-added", () => {
        const ledger = new Ledger();
        const id1 = ledger.createIdentity("USER", "foo");
        const id2 = ledger.createIdentity("USER", "bar");
        ledger.addAlias(id1, a1);
        ledger.removeAlias(id1, a1, 0);
        ledger.addAlias(id2, a1);
        const u2 = NullUtil.get(ledger.identityById(id2));
        expect(u2.aliases).toEqual([a1]);
      });
      it("errors on invalid credProportion", () => {
        const ledger = new Ledger();
        const id1 = ledger.createIdentity("USER", "foo");
        ledger.addAlias(id1, a1);
        for (const bad of [-0.3, 1.3, Infinity, NaN, -Infinity]) {
          failsWithoutMutation(
            ledger,
            () => ledger.removeAlias(id1, a1, bad),
            "invalid credProportion"
          );
        }
      });
    });
  });

  describe("grain accounts", () => {
    it("newly created identities have an empty account", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "foo");
      const account = ledger.account(id);
      expect(account).toEqual({
        id,
        paid: "0",
        balance: "0",
      });
      expect(ledger.accounts()).toEqual([account]);
    });
    it("unseen addresses don't have accounts", () => {
      const ledger = new Ledger();
      const thunk = () => ledger.account(id1);
      expect(thunk).toThrowError(`no GrainAccount for identity: ${id1}`);
      expect(ledger.accounts()).toEqual([]);
    });
  });

  describe("grain updates", () => {
    describe.skip("distributeGrain", () => {
      it("works for an empty distribution", () => {
        const ledger = new Ledger();
        const distribution = {credTimestamp: 1, allocations: []};
        setFakeDate(2);
        ledger.distributeGrain(distribution);
        expect(ledger.accounts()).toEqual([]);
        expect(ledger.eventLog()).toEqual([
          {
            version: "1",
            ledgerTimestamp: 2,
            action: {type: "DISTRIBUTE_GRAIN", version: "1", distribution},
          },
        ]);
      });
      it("handles a case with a single allocation", () => {
        const ledger = new Ledger();
        const allocation = {
          policy: {policyType: "IMMEDIATE", budget: g("10")},
          receipts: [
            {amount: g("3"), address: a1},
            {amount: g("7"), address: a2},
          ],
        };
        const distribution = {credTimestamp: 1, allocations: [allocation]};
        ledger.distributeGrain(distribution);
        const ac1 = {
          address: a1,
          identityId: null,
          balance: g("3"),
          paid: g("3"),
        };
        const ac2 = {
          address: a2,
          identityId: null,
          balance: g("7"),
          paid: g("7"),
        };
        expect(ledger.accounts()).toEqual([ac1, ac2]);
      });
      it("handles multiple allocations", () => {
        const ledger = new Ledger();
        const allocation1 = {
          policy: {policyType: "IMMEDIATE", budget: g("10")},
          receipts: [
            {amount: g("3"), address: a1},
            {amount: g("7"), address: a2},
          ],
        };
        const allocation2 = {
          policy: {policyType: "BALANCED", budget: g("20")},
          receipts: [
            {amount: g("10"), address: a1},
            {amount: g("10"), address: a2},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          allocations: [allocation1, allocation2],
        };
        ledger.distributeGrain(distribution);
        const ac1 = {
          address: a1,
          identityId: null,
          balance: g("13"),
          paid: g("13"),
        };
        const ac2 = {
          address: a2,
          identityId: null,
          balance: g("17"),
          paid: g("17"),
        };
        expect(ledger.accounts()).toEqual([ac1, ac2]);
      });
    });

    describe("transferGrain", () => {
      it("works in a simple legal case", () => {
        const ledger = ledgerWithIdentities();
        ledger._allocateGrain(id1, g("100"));
        ledger._allocateGrain(id2, g("5"));
        setFakeDate(4);
        ledger.transferGrain({
          from: id1,
          to: id2,
          amount: g("80"),
          memo: "test",
        });
        const account1 = {
          id: id1,
          paid: g("100"),
          balance: g("20"),
        };
        const account2 = {
          id: id2,
          paid: g("5"),
          balance: g("85"),
        };
        expect(ledger.account(id1)).toEqual(account1);
        expect(ledger.account(id2)).toEqual(account2);
        expect(ledger.eventLog()).toEqual([
          // Two createIdentity actions we aren't interested in
          expect.anything(),
          expect.anything(),
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "TRANSFER_GRAIN",
              version: "1",
              amount: "80",
              memo: "test",
              from: id1,
              to: id2,
            },
          },
        ]);
      });
      it("errors if the sender does not exist", () => {
        const ledger = ledgerWithIdentities();
        const thunk = () =>
          ledger.transferGrain({
            to: id1,
            from: id3,
            amount: G.ZERO,
            memo: null,
          });
        failsWithoutMutation(ledger, thunk, `invalid sender: ${id3}`);
      });
      it("errors if the recipient does not exist", () => {
        const ledger = ledgerWithIdentities();
        const thunk = () =>
          ledger.transferGrain({
            to: id3,
            from: id1,
            amount: G.ZERO,
            memo: null,
          });
        failsWithoutMutation(ledger, thunk, `invalid recipient: ${id3}`);
      });
      it("an account may transfer to itself", () => {
        const ledger = ledgerWithIdentities();
        ledger._allocateGrain(id1, g("2"));
        ledger.transferGrain({
          from: id1,
          to: id1,
          amount: g("1"),
          memo: "test",
        });
        const account = {
          id: id1,
          paid: g("2"),
          balance: g("2"),
        };
        expect(ledger.account(id1)).toEqual(account);
      });
      it("an account may not be overdrawn", () => {
        const ledger = ledgerWithIdentities();
        ledger._allocateGrain(id1, g("2"));
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: g("3"),
            memo: "test",
          });
        failsWithoutMutation(
          ledger,
          thunk,
          "insufficient balance for transfer"
        );
      });
      it("a negative transfer is illegal", () => {
        const ledger = ledgerWithIdentities();
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: g("-3"),
            memo: "test",
          });
        failsWithoutMutation(
          ledger,
          thunk,
          "cannot transfer negative Grain amount"
        );
      });
    });
  });

  describe("timestamps", () => {
    it("out-of-order events are illegal", () => {
      const ledger = new Ledger();
      setFakeDate(3);
      ledger.createIdentity("USER", "foo");
      setFakeDate(2);
      const thunk = () => ledger.createIdentity("USER", "foo");
      failsWithoutMutation(ledger, thunk, "out-of-order timestamp");
    });
    it("non-numeric timestamps are illegal", () => {
      const ledger = new Ledger();
      for (const bad of [NaN, Infinity, -Infinity]) {
        setFakeDate(bad);
        const thunk = () => ledger.createIdentity("USER", "foo");
        failsWithoutMutation(ledger, thunk, "invalid timestamp");
      }
    });
  });

  describe("state reconstruction", () => {
    // This is a ledger which has had at least one of every
    // supported Action.
    function richLedger(): Ledger {
      const ledger = new Ledger();
      setFakeDate(1);
      setNextUuid(id1);
      ledger.createIdentity("USER", "foo");
      setFakeDate(2);
      setNextUuid(id2);
      ledger.createIdentity("USER", "bar");
      setFakeDate(3);
      ledger.addAlias(id1, a1);
      setFakeDate(4);
      ledger.removeAlias(id1, a1, 0);
      setFakeDate(5);
      ledger.addAlias(id2, a1);

      /**
       * TODO: (@decentralion): Add this back in once we've refactored grain distributions.
      setFakeDate(6);
      ledger.distributeGrain({
        credTimestamp: 5,
        allocations: [
          {
            policy: {policyType: "IMMEDIATE", budget: g("100")},
            receipts: [
              {address: addr1, amount: g("50")},
              {address: addr2, amount: g("50")},
            ],
          },
        ],
      });
      setFakeDate(7);
      ledger.transferGrain({
        from: addr1,
        to: addr2,
        amount: g("10"),
        memo: null,
      });
      */
      return ledger;
    }
    it("fromEventLog with an empty action log results in an empty ledger", () => {
      const emptyLog = new Ledger().eventLog();
      expect(emptyLog).toEqual([]);
      expect(Ledger.fromEventLog(emptyLog)).toEqual(new Ledger());
    });
    it("eventLog and fromEventLog compose to identity", () => {
      const ledger = richLedger();
      expect(Ledger.fromEventLog(ledger.eventLog())).toEqual(ledger);
    });
    it("serialized LedgerLogs may be parsed", () => {
      const ledger = richLedger();
      const ledgerString = ledger.serialize();
      const ledgerJson = JSON.parse(ledgerString);
      expect(parser.parseOrThrow(ledgerJson)).toEqual(ledger);
    });
    it("serialized ledger snapshots as expected", () => {
      expect(richLedger().serialize()).toMatchSnapshot();
    });
  });
});
