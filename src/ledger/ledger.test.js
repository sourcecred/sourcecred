// @flow

import deepFreeze from "deep-freeze";
import cloneDeep from "lodash.clonedeep";
import {NodeAddress} from "../core/graph";
import {Ledger, parser} from "./ledger";
import {type DistributionPolicy, computeDistribution} from "./grainAllocation";
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

  const uuid1 = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
  const uuid2 = uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ");
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

  const a1 = NodeAddress.fromParts(["a1"]);
  const a2 = NodeAddress.fromParts(["a2"]);

  describe("identity updates", () => {
    describe("createIdentity", () => {
      it("works", () => {
        setFakeDate(123);
        const l = new Ledger();
        const id = l.createIdentity("foo");
        const foo = l.identityById(id);
        expect(l.identities()).toEqual([foo]);
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
        const thunk = () => ledger.createIdentity("foo bar");
        failsWithoutMutation(ledger, thunk, "invalid identityName");
        expect(ledger.identities()).toEqual([]);
      });
      it("throws an error if the identityName is taken", () => {
        const ledger = new Ledger();
        ledger.createIdentity("foo");
        const thunk = () => ledger.createIdentity("foo");
        failsWithoutMutation(ledger, thunk, "identityName already taken");
      });
      it("throws an error given an identity with aliases", () => {
        const ledger = new Ledger();
        let identity = newIdentity("foo");
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
        const id = ledger.createIdentity("foo");
        const initialIdentity = NullUtil.get(ledger.identityById(id));
        setFakeDate(1);
        ledger.renameIdentity(id, "bar");
        const identity = ledger.identityById(id);

        expect(identity).toEqual({
          id,
          name: "bar",
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
        const id = ledger.createIdentity("foo");
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
        const fooId = ledger.createIdentity("foo");
        ledger.createIdentity("bar");
        const thunk = () => ledger.renameIdentity(fooId, "bar");
        failsWithoutMutation(
          ledger,
          thunk,
          "renameIdentity: conflict on identityName bar"
        );
      });
      it("fails on invalid identityName", () => {
        const ledger = new Ledger();
        const fooId = ledger.createIdentity("foo");
        const thunk = () => ledger.renameIdentity(fooId, "foo bar");
        failsWithoutMutation(ledger, thunk, "invalid identityName");
      });
    });

    describe("addAlias", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("foo");
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
      it("if the alias has a balance, an extra TRANSFER_GRAIN event is emitted", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createIdentity("foo");
        ledger._allocateGrain(a1, g("100"));
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
              type: "TRANSFER_GRAIN",
              version: "1",
              from: a1,
              to: identity.address,
              memo: "transfer from alias to canonical account",
              amount: "100",
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
        ledger._allocateGrain(a1, G.ONE);
        failsWithoutMutation(
          ledger,
          (l) => l.addAlias(uuid.random(), a1),
          "addAlias: no matching identityId"
        );
      });
      it("throws an error if the identity already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("foo");
        ledger.addAlias(id, a1);
        ledger._allocateGrain(a1, G.ONE);
        const thunk = () => ledger.addAlias(id, a1);
        failsWithoutMutation(ledger, thunk, "identity already has alias");
      });
      it("errors if the address is another identity's alias", () => {
        const ledger = new Ledger();
        const id1 = ledger.createIdentity("foo");
        const id2 = ledger.createIdentity("bar");
        ledger.addAlias(id1, a1);
        ledger._allocateGrain(a1, G.ONE);
        const thunk = () => ledger.addAlias(id2, a1);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(a1)} already bound`
        );
      });
      it("errors if the address is the identity's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("foo");
        const identity = NullUtil.get(ledger.identityById(id));
        ledger._allocateGrain(identity.address, G.ONE);
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
        const id1 = ledger.createIdentity("foo");
        const identity1 = NullUtil.get(ledger.identityById(id1));
        const id2 = ledger.createIdentity("bar");
        ledger._allocateGrain(identity1.address, G.ONE);
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
        const id = ledger.createIdentity("foo");
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
          "removeAlias: no identity matching id"
        );
      });
      it("throws an error if the identity doesn't already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("foo");
        const thunk = () => ledger.removeAlias(id, a1, 0);
        failsWithoutMutation(ledger, thunk, "identity does not have alias");
      });
      it("errors if the address is the identity's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("foo");
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
        const id1 = ledger.createIdentity("foo");
        const id2 = ledger.createIdentity("bar");
        ledger.addAlias(id1, a1);
        ledger.removeAlias(id1, a1, 0);
        ledger.addAlias(id2, a1);
        const u2 = NullUtil.get(ledger.identityById(id2));
        expect(u2.aliases).toEqual([a1]);
      });
      it("errors on invalid credProportion", () => {
        const ledger = new Ledger();
        const id1 = ledger.createIdentity("foo");
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

  describe("canonicalAddress", () => {
    it("identities' addresses are canonical", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("foo");
      const identity = NullUtil.get(ledger.identityById(id));
      expect(ledger.canonicalAddress(identity.address)).toEqual(
        identity.address
      );
    });
    it("hitherto unseen addresses are canonical", () => {
      const ledger = new Ledger();
      expect(ledger.canonicalAddress(a1)).toEqual(a1);
    });
    it("aliases are not canonical", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("foo");
      const identity = NullUtil.get(ledger.identityById(id));
      ledger.addAlias(id, a1);
      expect(ledger.canonicalAddress(a1)).toEqual(identity.address);
    });
    it("unlinked aliases are again canonical", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("foo");
      ledger.addAlias(id, a1).removeAlias(id, a1, 0);
      expect(ledger.canonicalAddress(a1)).toEqual(a1);
    });
  });

  describe("grain accounts", () => {
    it("newly created identities have an empty account", () => {
      const ledger = new Ledger();
      const identityId = ledger.createIdentity("foo");
      const address = NullUtil.get(ledger.identityById(identityId)).address;
      const account = ledger.accountByAddress(address);
      expect(account).toEqual({
        identityId,
        address,
        paid: "0",
        balance: "0",
      });
      expect(ledger.accounts()).toEqual([account]);
    });
    it("unseen addresses don't have accounts", () => {
      const ledger = new Ledger();
      expect(ledger.accountByAddress(a1)).toEqual(undefined);
      expect(ledger.accounts()).toEqual([]);
    });
    it("non-identity addresses can have accounts", () => {
      const ledger = new Ledger();
      ledger._allocateGrain(a1, g("10"));
      const account = ledger.accountByAddress(a1);
      expect(account).toEqual({
        identityId: null,
        address: a1,
        balance: "10",
        paid: "10",
      });
      expect(ledger.accounts()).toEqual([account]);
    });
    it("accountByAddress returns canonical accounts", () => {
      const ledger = new Ledger();
      const identityId = ledger.createIdentity("foo");
      const addr = NullUtil.get(ledger.identityById(identityId)).address;
      ledger.addAlias(identityId, a1);
      expect(ledger.accountByAddress(a1)).toEqual({
        // Note: we asked for `a1`, but got address `addr`.
        // This is intended behavior.
        address: addr,
        identityId,
        paid: "0",
        balance: "0",
      });
    });
    it("when a identity gets an alias, it claims the alias's balance", () => {
      const ledger = new Ledger();
      const identityId = ledger.createIdentity("foo");
      const addr = NullUtil.get(ledger.identityById(identityId)).address;
      ledger._allocateGrain(a1, g("2"));
      ledger._allocateGrain(addr, g("1"));
      ledger.addAlias(identityId, a1);
      const identityAccount = ledger.accountByAddress(addr);
      expect(identityAccount).toEqual({
        identityId,
        address: addr,
        paid: "3",
        balance: "3",
      });
      expect(ledger.accounts()).toEqual([identityAccount]);
    });
    it("if an alias is allocated Grain, it's received by the canonical address", () => {
      const ledger = new Ledger();
      const identityId = ledger.createIdentity("foo");
      const addr = NullUtil.get(ledger.identityById(identityId)).address;
      ledger.addAlias(identityId, a1);
      ledger._allocateGrain(a1, g("2"));
      ledger._allocateGrain(addr, g("1"));
      const identityAccount = ledger.accountByAddress(addr);
      expect(identityAccount).toEqual({
        identityId,
        address: addr,
        paid: "3",
        balance: "3",
      });
      expect(ledger.accounts()).toEqual([identityAccount]);
    });
    it("removed alias accounts with retroactive payouts are handled correctly", () => {
      const examples = [
        {
          credProportion: 0.1,
          expectedRetroactivePaid: g("10"),
        },
        {
          credProportion: 1,
          expectedRetroactivePaid: g("100"),
        },
      ];
      for (const {credProportion, expectedRetroactivePaid} of examples) {
        const ledger = new Ledger();
        const identityId = ledger.createIdentity("foo");
        const addr = NullUtil.get(ledger.identityById(identityId)).address;
        ledger.addAlias(identityId, a1);
        ledger._allocateGrain(a1, g("100"));
        ledger.removeAlias(identityId, a1, credProportion);
        const aliasAccount = ledger.accountByAddress(a1);
        expect(aliasAccount).toEqual({
          identityId: null,
          address: a1,
          paid: expectedRetroactivePaid,
          balance: "0",
        });
        const identityAccount = ledger.accountByAddress(addr);
        expect(identityAccount).toEqual({
          identityId,
          address: addr,
          paid: G.sub(g("100"), expectedRetroactivePaid),
          balance: "100",
        });
        expect(ledger.accounts()).toEqual([identityAccount, aliasAccount]);
      }
    });
    it("removed aliases without retroactive payouts don't have an alias account", () => {
      const ledger = new Ledger();
      const identityId = ledger.createIdentity("foo");
      const addr = NullUtil.get(ledger.identityById(identityId)).address;
      ledger.addAlias(identityId, a1);
      ledger._allocateGrain(a1, g("100"));
      ledger.removeAlias(identityId, a1, 0);
      const aliasAccount = ledger.accountByAddress(a1);
      expect(aliasAccount).toEqual(undefined);
      const identityAccount = ledger.accountByAddress(addr);
      expect(identityAccount).toEqual({
        identityId,
        address: addr,
        paid: "100",
        balance: "100",
      });
      expect(ledger.accounts()).toEqual([identityAccount]);
    });
  });

  describe("grain updates", () => {
    describe("distributeGrain", () => {
      // Motivation for the following history:
      // Across the history, both addresses earn equally, so the BALANCED
      // payout wants to give equal Grain
      // In the most recent week, only a2 had cred, so the IMMEDIATE payout
      // gives Grain only to them.
      const credHistory = deepFreeze([
        {
          cred: new Map([
            [a1, 2],
            [a2, 1],
          ]),
          intervalEndMs: 1,
        },
        {
          cred: new Map([
            [a1, 0],
            [a2, 1],
          ]),
          intervalEndMs: 3,
        },
      ]);
      it("produces an empty distribution if there are no policies", () => {
        setFakeDate(4);
        const ledger = new Ledger().distributeGrain([], credHistory);
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "DISTRIBUTE_GRAIN",
              version: "1",
              distribution: {credTimestamp: 3, allocations: []},
            },
          },
        ]);
        expect(ledger.accounts()).toEqual([]);
      });
      it("errors if credHistory contains non-canonical addresses", () => {
        const ledger = new Ledger();
        const id = ledger.createIdentity("foo");
        ledger.addAlias(id, a1);
        const thunk = () => ledger.distributeGrain([], credHistory);
        failsWithoutMutation(
          ledger,
          thunk,
          "non-canonical address in credHistory"
        );
      });
      it("computes an IMMEDIATE allocation correctly", () => {
        const policy: DistributionPolicy = {
          budget: g("10"),
          policyType: "IMMEDIATE",
        };
        setFakeDate(4);
        const ledger = new Ledger().distributeGrain([policy], credHistory);
        const expectedDistribution = computeDistribution(
          [policy],
          credHistory,
          new Map()
        );
        const account1 = ledger.accountByAddress(a1);
        const account2 = ledger.accountByAddress(a2);
        expect(account1).toEqual({
          address: a1,
          identityId: null,
          balance: "0",
          paid: "0",
        });
        expect(account2).toEqual({
          address: a2,
          identityId: null,
          balance: "10",
          paid: "10",
        });
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "DISTRIBUTE_GRAIN",
              version: "1",
              distribution: expectedDistribution,
            },
          },
        ]);
      });
      it("computes a BALANCED allocation correctly", () => {
        const policy: DistributionPolicy = {
          budget: g("15"),
          policyType: "BALANCED",
        };
        setFakeDate(4);
        const ledger = new Ledger();
        // Give a2 some past payouts, so that the BALANCED
        // strategy should preferentially pay a1
        ledger._allocateGrain(a2, g("5"));
        const expectedDistribution = computeDistribution(
          [policy],
          credHistory,
          new Map([[a2, g("5")]])
        );
        ledger.distributeGrain([policy], credHistory);
        const account1 = ledger.accountByAddress(a1);
        const account2 = ledger.accountByAddress(a2);
        expect(account1).toEqual({
          address: a1,
          identityId: null,
          balance: "10",
          paid: "10",
        });
        expect(account2).toEqual({
          address: a2,
          identityId: null,
          balance: "10",
          paid: "10",
        });
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "DISTRIBUTE_GRAIN",
              version: "1",
              distribution: expectedDistribution,
            },
          },
        ]);
      });
      it("BALANCED strategy accounts for unlinked aliases' retroactive paid", () => {
        // Sanity check since this property is important.
        const p: DistributionPolicy = {
          budget: g("7"),
          policyType: "BALANCED",
        };
        const ledger = new Ledger();
        setFakeDate(4);
        const identityId = ledger.createIdentity("identity");
        const aU = NullUtil.get(ledger.identityById(identityId)).address;
        setFakeDate(5);
        ledger.addAlias(identityId, a1);
        ledger._allocateGrain(aU, g("10"));
        setFakeDate(6);
        ledger.removeAlias(identityId, a1, 0.5);
        setFakeDate(7);
        ledger.distributeGrain([p], credHistory);
        // From the perspective of the balanced payout: a1 and a2 have equal cred,
        // and a1 has a retroactive allotment of 5 Grain, so therefore from this payout,
        // 6 should go to a2, and 1 should go to a1, bringing them both to 6 Grain post-payout.
        const expectedDistribution = computeDistribution(
          [p],
          credHistory,
          new Map([[a1, g("5")]])
        );
        const accountU = ledger.accountByAddress(aU);
        const account1 = ledger.accountByAddress(a1);
        const account2 = ledger.accountByAddress(a2);
        expect(accountU).toEqual({
          address: aU,
          identityId,
          balance: "10",
          paid: "5",
        });
        expect(account1).toEqual({
          address: a1,
          identityId: null,
          balance: "1",
          paid: "6",
        });
        expect(account2).toEqual({
          address: a2,
          identityId: null,
          balance: "6",
          paid: "6",
        });
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "CREATE_IDENTITY",
              version: "1",
              identity: expect.anything(),
            },
          },
          {
            ledgerTimestamp: 5,
            version: "1",
            action: {
              type: "ADD_ALIAS",
              version: "1",
              identityId,
              alias: a1,
            },
          },
          {
            ledgerTimestamp: 6,
            version: "1",
            action: {
              type: "REMOVE_ALIAS",
              version: "1",
              identityId,
              alias: a1,
              retroactivePaid: "5",
            },
          },
          {
            ledgerTimestamp: 7,
            version: "1",
            action: {
              type: "DISTRIBUTE_GRAIN",
              version: "1",
              distribution: expectedDistribution,
            },
          },
        ]);
        expect(ledger.accounts()).toEqual([accountU, account1, account2]);
      });
    });

    describe("transferGrain", () => {
      it("works in a simple legal case", () => {
        const ledger = new Ledger();
        ledger._allocateGrain(a1, g("100"));
        ledger._allocateGrain(a2, g("5"));
        setFakeDate(4);
        ledger.transferGrain({from: a1, to: a2, amount: g("80"), memo: "test"});
        const e1 = {
          address: a1,
          identityId: null,
          paid: g("100"),
          balance: g("20"),
        };
        const e2 = {
          address: a2,
          identityId: null,
          paid: g("5"),
          balance: g("85"),
        };
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "TRANSFER_GRAIN",
              version: "1",
              amount: "80",
              memo: "test",
              from: a1,
              to: a2,
            },
          },
        ]);
      });
      it("creates a GrainAccount for the recipient, if it did not already exist", () => {
        const ledger = new Ledger();
        ledger._allocateGrain(a1, g("1"));
        setFakeDate(4);
        ledger.transferGrain({from: a1, to: a2, amount: g("1"), memo: "test"});
        const e1 = {
          address: a1,
          identityId: null,
          paid: g("1"),
          balance: g("0"),
        };
        const e2 = {
          address: a2,
          identityId: null,
          paid: g("0"),
          balance: g("1"),
        };
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "TRANSFER_GRAIN",
              version: "1",
              amount: "1",
              memo: "test",
              from: a1,
              to: a2,
            },
          },
        ]);
      });
      it("a zero-amount transfer from a nonexistent account is legal", () => {
        // and should result in both accounts getting reified, i.e. if a previously
        // empty alias sends a transaction, it gets a GrainAccount.
        const ledger = new Ledger();
        setFakeDate(4);
        ledger.transferGrain({from: a1, to: a2, amount: g("0"), memo: "test"});
        const e1 = {
          address: a1,
          identityId: null,
          paid: g("0"),
          balance: g("0"),
        };
        const e2 = {
          address: a2,
          identityId: null,
          paid: g("0"),
          balance: g("0"),
        };
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.eventLog()).toEqual([
          {
            ledgerTimestamp: 4,
            version: "1",
            action: {
              type: "TRANSFER_GRAIN",
              version: "1",
              amount: "0",
              memo: "test",
              from: a1,
              to: a2,
            },
          },
        ]);
      });
      it("if a transfer sends from an alias, the canonical account is debited", () => {
        const ledger = new Ledger();
        const identityId = ledger.createIdentity("identity");
        const address = NullUtil.get(ledger.identityById(identityId)).address;
        ledger.addAlias(identityId, a1);
        ledger._allocateGrain(a1, g("1"));
        ledger.transferGrain({from: a1, to: a2, amount: g("1"), memo: "test"});
        const e1 = {
          address,
          identityId,
          paid: g("1"),
          balance: g("0"),
        };
        const e2 = {
          address: a2,
          identityId: null,
          paid: g("0"),
          balance: g("1"),
        };
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.accounts()).toEqual([e1, e2]);
      });
      it("if a transfers sends to an alias, the canonical account is credited", () => {
        const ledger = new Ledger();
        const identityId = ledger.createIdentity("identity");
        const addr = NullUtil.get(ledger.identityById(identityId)).address;
        ledger.addAlias(identityId, a1);
        ledger._allocateGrain(a2, g("1"));
        ledger.transferGrain({from: a2, to: a1, amount: g("1"), memo: "test"});
        const e1 = {
          address: addr,
          identityId,
          paid: g("0"),
          balance: g("1"),
        };
        const e2 = {
          address: a2,
          identityId: null,
          paid: g("1"),
          balance: g("0"),
        };
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.accounts()).toEqual([e1, e2]);
      });
      it("an account may transfer to itself", () => {
        const ledger = new Ledger();
        ledger._allocateGrain(a1, g("2"));
        ledger.transferGrain({from: a1, to: a1, amount: g("1"), memo: "test"});
        const e1 = {
          address: a1,
          identityId: null,
          paid: g("2"),
          balance: g("2"),
        };
        expect(ledger.accountByAddress(a1)).toEqual(e1);
      });
      it("an account may not be overdrawn", () => {
        const ledger = new Ledger();
        ledger._allocateGrain(a1, g("2"));
        const thunk = () =>
          ledger.transferGrain({
            from: a1,
            to: a2,
            amount: g("3"),
            memo: "test",
          });
        expect(thunk).toThrowError("insufficient balance for transfer");
      });
      it("a negative transfer is illegal", () => {
        const ledger = new Ledger();
        ledger._allocateGrain(a1, g("2"));
        const thunk = () =>
          ledger.transferGrain({
            from: a1,
            to: a2,
            amount: g("-3"),
            memo: "test",
          });
        expect(thunk).toThrowError("cannot transfer negative Grain amount");
      });
    });
  });

  describe("timestamps", () => {
    it("out-of-order events are illegal", () => {
      const ledger = new Ledger();
      setFakeDate(3);
      ledger.createIdentity("foo");
      setFakeDate(2);
      const thunk = () => ledger.createIdentity("foo");
      failsWithoutMutation(ledger, thunk, "out-of-order timestamp");
    });
    it("non-numeric timestamps are illegal", () => {
      const ledger = new Ledger();
      for (const bad of [NaN, Infinity, -Infinity]) {
        setFakeDate(bad);
        const thunk = () => ledger.createIdentity("foo");
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
      setNextUuid(uuid1);
      const id1 = ledger.createIdentity("foo");
      const addr1 = NullUtil.get(ledger.identityById(id1)).address;
      setFakeDate(2);
      setNextUuid(uuid2);
      const id2 = ledger.createIdentity("bar");
      const addr2 = NullUtil.get(ledger.identityById(id2)).address;
      setFakeDate(3);
      ledger.addAlias(id1, a1);
      setFakeDate(4);
      ledger.removeAlias(id1, a1, 0);
      setFakeDate(5);
      ledger.addAlias(id2, a1);

      const policies = [
        {budget: g("400"), policyType: "BALANCED"},
        {budget: g("100"), policyType: "IMMEDIATE"},
      ];
      const credHistory = [
        {
          intervalEndMs: 10,
          cred: new Map([
            [addr1, 5],
            [addr2, 0],
          ]),
        },
        {
          intervalEndMs: 20,
          cred: new Map([
            [addr1, 3],
            [addr2, 7],
          ]),
        },
      ];
      setFakeDate(6);
      ledger.distributeGrain(policies, credHistory);
      setFakeDate(7);
      ledger.transferGrain({
        from: addr1,
        to: addr2,
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
