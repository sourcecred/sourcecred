// @flow

import cloneDeep from "lodash.clonedeep";
import {NodeAddress} from "../core/graph";
import {Ledger, parser} from "./ledger";
import {newIdentity} from "./identity";
import * as G from "./grain";
import * as uuid from "../util/uuid"; // for spy purposes

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

  const identity1 = () => {
    setNextUuid(id1);
    return newIdentity("USER", "steven");
  };
  const identity2 = () => {
    setNextUuid(id2);
    return newIdentity("ORGANIZATION", "crystal-gems");
  };

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

  function ledgerWithActiveIdentities() {
    const ledger = ledgerWithIdentities();
    setFakeDate(2);
    ledger.activate(id1);
    setFakeDate(2);
    ledger.activate(id2);
    return ledger;
  }

  const a1 = NodeAddress.fromParts(["a1"]);

  describe("identity updates", () => {
    describe("createIdentity", () => {
      it("works", () => {
        setFakeDate(123);
        const l = new Ledger();
        const id = l.createIdentity("USER", "steven");
        const account = l.account(id);
        const identity = account.identity;
        expect(identity.subtype).toEqual("USER");
        expect(identity.name).toEqual("steven");
        expect(account).toEqual({
          paid: "0",
          balance: "0",
          active: false,
          identity,
        });
        expect(l.eventLog()).toEqual([
          {
            ledgerTimestamp: 123,
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              identity,
              version: "1",
            },
          },
        ]);
      });
      it("throws an error if the identityName is invalid", () => {
        const ledger = new Ledger();
        const thunk = () => ledger.createIdentity("USER", "foo bar");
        failsWithoutMutation(ledger, thunk, "invalid identityName");
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
        const initialIdentity = ledger.account(id).identity;
        setFakeDate(1);
        ledger.renameIdentity(id, "bar");
        const identity = ledger.account(id).identity;

        expect(identity).toEqual({
          id,
          name: "bar",
          subtype: "USER",
          address: initialIdentity.address,
          aliases: [],
        });

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
        const identity = ledger.account(id).identity;
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
          "no identity matches id"
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
        const identity = ledger.account(id).identity;
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
        const ledger = ledgerWithIdentities();
        const thunk = () => ledger.addAlias(id2, identity1().address);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(
            identity1().address
          )} already bound`
        );
      });
    });
  });

  describe("grain accounts", () => {
    it("unseen addresses don't have accounts", () => {
      const ledger = new Ledger();
      const thunk = () => ledger.account(id1);
      expect(thunk).toThrowError(`no Account for identity: ${id1}`);
      expect(ledger.accounts()).toEqual([]);
    });

    it("accounts may be activated", () => {
      const ledger = new Ledger();
      setNextUuid(id1);
      ledger.createIdentity("USER", "steven");
      ledger.activate(id1);
      expect(ledger.account(id1)).toEqual({
        identity: identity1(),
        paid: "0",
        balance: "0",
        active: true,
      });
      expect(ledger.eventLog()).toEqual([
        expect.anything(),
        {
          ledgerTimestamp: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", version: "1", identityId: id1},
          version: "1",
        },
      ]);
    });
    it("accounts may be deactivated", () => {
      const ledger = new Ledger();
      setNextUuid(id1);
      ledger.createIdentity("USER", "steven");
      ledger.activate(id1);
      ledger.deactivate(id1);
      expect(ledger.account(id1)).toEqual({
        identity: identity1(),
        paid: "0",
        balance: "0",
        active: false,
      });
      expect(ledger.eventLog()).toEqual([
        expect.anything(),
        {
          ledgerTimestamp: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", version: "1", identityId: id1},
          version: "1",
        },
        {
          ledgerTimestamp: expect.anything(),
          action: {type: "TOGGLE_ACTIVATION", version: "1", identityId: id1},
          version: "1",
        },
      ]);
    });
    it("deactivating an inactive account is a no-op", () => {
      const l1 = ledgerWithIdentities();
      const l2 = ledgerWithIdentities();
      l1.deactivate(id1);
      expect(l1).toEqual(l2);
    });
    it("activating an already-active account is a no-op", () => {
      function ex() {
        const ledger = ledgerWithIdentities();
        setFakeDate(3);
        ledger.activate(id1);
        return ledger;
      }
      const l1 = ex();
      const l2 = ex();
      l1.activate(id1);
      expect(l1).toEqual(l2);
    });
    it("activating a non-existent account throws an error", () => {
      const l = new Ledger();
      failsWithoutMutation(
        l,
        () => l.activate(id1),
        `identity ${id1} not found`
      );
    });
    it("deactivating a non-existent account throws an error", () => {
      const l = new Ledger();
      failsWithoutMutation(
        l,
        () => l.deactivate(id1),
        `identity ${id1} not found`
      );
    });
    it("an inactive account may hold onto a Grain balance", () => {
      const ledger = ledgerWithActiveIdentities();
      ledger._allocateGrain(id1, g("50"));
      ledger.deactivate(id1);
      expect(ledger.account(id1)).toEqual({
        identity: identity1(),
        paid: g("50"),
        balance: g("50"),
        active: false,
      });
    });
  });

  describe("grain updates", () => {
    describe("distributeGrain", () => {
      it("works for an empty distribution", () => {
        const ledger = new Ledger();
        const distribution = {
          credTimestamp: 1,
          allocations: [],
          id: uuid.random(),
        };
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
        const ledger = ledgerWithActiveIdentities();
        const allocation = {
          policy: {policyType: "IMMEDIATE", budget: g("10")},
          id: uuid.random(),
          receipts: [
            {amount: g("3"), id: id1},
            {amount: g("7"), id: id2},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          allocations: [allocation],
          id: uuid.random(),
        };
        ledger.distributeGrain(distribution);
        const ac1 = {
          identity: identity1(),
          balance: g("3"),
          paid: g("3"),
          active: true,
        };
        const ac2 = {
          identity: identity2(),
          balance: g("7"),
          paid: g("7"),
          active: true,
        };
        expect(ledger.accounts()).toEqual([ac1, ac2]);
      });
      it("handles multiple allocations", () => {
        const ledger = ledgerWithActiveIdentities();
        const allocation1 = {
          policy: {policyType: "IMMEDIATE", budget: g("10")},
          id: uuid.random(),
          receipts: [
            {amount: g("3"), id: id1},
            {amount: g("7"), id: id2},
          ],
        };
        const allocation2 = {
          id: uuid.random(),
          policy: {policyType: "BALANCED", budget: g("20")},
          receipts: [
            {amount: g("10"), id: id1},
            {amount: g("10"), id: id2},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          allocations: [allocation1, allocation2],
          id: uuid.random(),
        };
        ledger.distributeGrain(distribution);
        const ac1 = {
          identity: identity1(),
          balance: g("13"),
          paid: g("13"),
          active: true,
        };
        const ac2 = {
          identity: identity2(),
          balance: g("17"),
          paid: g("17"),
          active: true,
        };
        expect(ledger.accounts()).toEqual([ac1, ac2]);
      });
      it("fails if any receipt has invalid id", () => {
        const ledger = ledgerWithActiveIdentities();
        const allocation = {
          policy: {policyType: "IMMEDIATE", budget: g("7")},
          id: uuid.random(),
          receipts: [
            {id: id1, amount: g("3")},
            {id: id3, amount: g("4")},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          id: uuid.random(),
          allocations: [allocation],
        };
        const thunk = () => ledger.distributeGrain(distribution);
        failsWithoutMutation(ledger, thunk, "invalid id");
      });
      it("fails if any receipt has invalid amount", () => {
        const ledger = ledgerWithActiveIdentities();
        const allocation = {
          policy: {policyType: "IMMEDIATE", budget: g("7")},
          id: uuid.random(),
          receipts: [
            {id: id1, amount: g("3")},
            {id: id2, amount: g("-4")},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          id: uuid.random(),
          allocations: [allocation],
        };
        const thunk = () => ledger.distributeGrain(distribution);
        failsWithoutMutation(ledger, thunk, "negative Grain amount");
      });
      it("fails if any receipt goes to inactive identity", () => {
        const ledger = ledgerWithIdentities();
        ledger.activate(id1);
        const allocation = {
          policy: {policyType: "IMMEDIATE", budget: g("7")},
          id: uuid.random(),
          receipts: [
            {id: id1, amount: g("3")},
            {id: id2, amount: g("4")},
          ],
        };
        const distribution = {
          credTimestamp: 1,
          id: uuid.random(),
          allocations: [allocation],
        };
        const thunk = () => ledger.distributeGrain(distribution);
        failsWithoutMutation(ledger, thunk, "distribute to inactive account");
      });
    });

    describe("transferGrain", () => {
      it("works in a simple legal case", () => {
        const ledger = ledgerWithActiveIdentities();
        ledger._allocateGrain(id1, g("100"));
        ledger._allocateGrain(id2, g("5"));
        setFakeDate(5);
        ledger.transferGrain({
          from: id1,
          to: id2,
          amount: g("80"),
          memo: "test",
        });
        const account1 = {
          identity: identity1(),
          paid: g("100"),
          balance: g("20"),
          active: true,
        };
        const account2 = {
          identity: identity2(),
          paid: g("5"),
          balance: g("85"),
          active: true,
        };
        expect(ledger.account(id1)).toEqual(account1);
        expect(ledger.account(id2)).toEqual(account2);
        expect(ledger.eventLog()).toEqual([
          // Two createIdentity actions we aren't interested in
          expect.anything(),
          expect.anything(),
          // Two toggle activation actions we aren't interested in
          expect.anything(),
          expect.anything(),
          {
            ledgerTimestamp: 5,
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
        const ledger = ledgerWithActiveIdentities();
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
        const ledger = ledgerWithActiveIdentities();
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
        const ledger = ledgerWithActiveIdentities();
        ledger._allocateGrain(id1, g("2"));
        ledger.transferGrain({
          from: id1,
          to: id1,
          amount: g("1"),
          memo: "test",
        });
        const account = {
          identity: identity1(),
          paid: g("2"),
          balance: g("2"),
          active: true,
        };
        expect(ledger.account(id1)).toEqual(account);
      });
      it("an account may not be overdrawn", () => {
        const ledger = ledgerWithActiveIdentities();
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
        const ledger = ledgerWithActiveIdentities();
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
      it("a transfer from an inactive account is illegal", () => {
        const ledger = ledgerWithIdentities();
        ledger.activate(id2);
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: g("3"),
            memo: "test",
          });
        failsWithoutMutation(ledger, thunk, "transfer from inactive account");
      });
      it("a transfer to an inactive account is illegal", () => {
        const ledger = ledgerWithIdentities();
        ledger.activate(id1);
        const thunk = () =>
          ledger.transferGrain({
            from: id1,
            to: id2,
            amount: g("3"),
            memo: "test",
          });
        failsWithoutMutation(ledger, thunk, "transfer to inactive account");
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
      const ledger = ledgerWithIdentities();
      setFakeDate(3);
      ledger.addAlias(id1, a1);

      const distributionId = uuid.fromString("f9xPz9YGH0PuBpPAg2824Q");
      const allocationId = uuid.fromString("yYNur0NEEkh7fMaUn6n9QQ");
      setFakeDate(4);
      ledger.activate(id1);
      setFakeDate(4);
      ledger.activate(id2);
      setFakeDate(4);
      ledger.distributeGrain({
        credTimestamp: 1,
        id: distributionId,
        allocations: [
          {
            id: allocationId,
            policy: {policyType: "IMMEDIATE", budget: g("100")},
            receipts: [
              {id: id1, amount: g("50")},
              {id: id2, amount: g("50")},
            ],
          },
        ],
      });
      setFakeDate(5);
      ledger.transferGrain({
        from: id1,
        to: id2,
        amount: g("10"),
        memo: null,
      });
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
