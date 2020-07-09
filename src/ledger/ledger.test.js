// @flow

import deepFreeze from "deep-freeze";
import cloneDeep from "lodash.clonedeep";
import {random as randomUuid} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {Ledger, type DistributionPolicy} from "./ledger";
import {userAddress} from "./user";
import * as G from "./grain";

describe("ledger/ledger", () => {
  // Helper for constructing Grain values.
  const g = (s) => G.fromString(s);
  function setFakeDate(ts: number) {
    jest.spyOn(global.Date, "now").mockImplementationOnce(() => ts);
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

  describe("user updates", () => {
    describe("createUser", () => {
      it("works", () => {
        setFakeDate(123);
        const l = new Ledger();
        const id = l.createUser("foo");
        const foo = l.userById(id);
        expect(l.users()).toEqual([foo]);
        expect(l.actionLog()).toEqual([
          {
            type: "CREATE_USER",
            username: "foo",
            version: 1,
            timestamp: 123,
            userId: id,
          },
        ]);
      });
      it("throws an error if the username is invalid", () => {
        const ledger = new Ledger();
        const thunk = () => ledger.createUser("foo bar");
        failsWithoutMutation(ledger, thunk, "invalid username");
        expect(ledger.users()).toEqual([]);
      });
      it("throws an error if the username is taken", () => {
        const ledger = new Ledger();
        ledger.createUser("foo");
        const thunk = () => ledger.createUser("foo");
        failsWithoutMutation(ledger, thunk, "username already taken");
      });
      it("throws on unrecognized version", () => {
        // $FlowExpectedError
        expect(() => new Ledger()._createUser({version: 1337})).toThrowError(
          "unrecognized version"
        );
      });
    });

    describe("renameUser", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createUser("foo");
        setFakeDate(1);
        ledger.renameUser(id, "bar");
        const user = ledger.userById(id);

        expect(user).toEqual({id, name: "bar", aliases: []});
        expect(ledger.userByUsername("bar")).toEqual(user);
        expect(ledger.userByUsername("foo")).toEqual(undefined);
        expect(ledger.users()).toEqual([user]);

        expect(ledger.actionLog()).toEqual([
          {
            type: "CREATE_USER",
            version: 1,
            username: "foo",
            timestamp: 0,
            userId: id,
          },
          {
            type: "RENAME_USER",
            version: 1,
            newName: "bar",
            userId: id,
            timestamp: 1,
          },
        ]);
      });
      it("fails if the user already has that name", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
        const thunk = () => ledger.renameUser(id, "foo");
        failsWithoutMutation(
          ledger,
          thunk,
          "renameUser: user already has name"
        );
      });
      it("fails on nonexistent user id", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.renameUser(randomUuid(), "bar"),
          "renameUser: no user matches id"
        );
      });
      it("fails on username conflict", () => {
        const ledger = new Ledger();
        const fooId = ledger.createUser("foo");
        ledger.createUser("bar");
        const thunk = () => ledger.renameUser(fooId, "bar");
        failsWithoutMutation(
          ledger,
          thunk,
          "renameUser: conflict on username bar"
        );
      });
      it("fails on invalid username", () => {
        const ledger = new Ledger();
        const fooId = ledger.createUser("foo");
        const thunk = () => ledger.renameUser(fooId, "foo bar");
        failsWithoutMutation(ledger, thunk, "invalid username");
      });
      it("throws on unrecognized version", () => {
        // $FlowExpectedError
        expect(() => new Ledger()._renameUser({version: 1337})).toThrowError(
          "unrecognized version"
        );
      });
    });

    describe("addAlias", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createUser("foo");
        setFakeDate(1);
        ledger.addAlias(id, a1);
        const user = ledger.userById(id);
        expect(user).toEqual({id, name: "foo", aliases: [a1]});
        expect(ledger.actionLog()).toEqual([
          {
            type: "CREATE_USER",
            version: 1,
            timestamp: 0,
            userId: id,
            username: "foo",
          },
          {
            type: "ADD_ALIAS",
            version: 1,
            timestamp: 1,
            userId: id,
            alias: a1,
          },
        ]);
      });
      it("errors if there's no matching user", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.addAlias(randomUuid(), a1),
          "addAlias: no matching userId"
        );
      });
      it("throws an error if the user already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
        ledger.addAlias(id, a1);
        const thunk = () => ledger.addAlias(id, a1);
        failsWithoutMutation(ledger, thunk, "user already has alias");
      });
      it("errors if the address is another user's alias", () => {
        const ledger = new Ledger();
        const id1 = ledger.createUser("foo");
        const id2 = ledger.createUser("bar");
        ledger.addAlias(id1, a1);
        const thunk = () => ledger.addAlias(id2, a1);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(a1)} already bound`
        );
      });
      it("errors if the address is the user's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
        const innateAddress = userAddress(id);
        const thunk = () => ledger.addAlias(id, innateAddress);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(innateAddress)} already bound`
        );
      });
      it("errors if the address is another user's innate address", () => {
        const ledger = new Ledger();
        const id1 = ledger.createUser("foo");
        const innateAddress = userAddress(id1);
        const id2 = ledger.createUser("bar");
        const thunk = () => ledger.addAlias(id2, innateAddress);
        failsWithoutMutation(
          ledger,
          thunk,
          `addAlias: alias ${NodeAddress.toString(innateAddress)} already bound`
        );
      });
      it("throws on unrecognized version", () => {
        // $FlowExpectedError
        expect(() => new Ledger()._addAlias({version: 1337})).toThrowError(
          "unrecognized version"
        );
      });
    });
    describe("removeAlias", () => {
      it("works", () => {
        const ledger = new Ledger();
        setFakeDate(0);
        const id = ledger.createUser("foo");
        setFakeDate(1);
        ledger.addAlias(id, a1);
        setFakeDate(2);
        ledger.removeAlias(id, a1, 0);
        const user = ledger.userById(id);
        expect(user).toEqual({id, name: "foo", aliases: []});
        expect(ledger.actionLog()).toEqual([
          {
            type: "CREATE_USER",
            version: 1,
            timestamp: 0,
            userId: id,
            username: "foo",
          },
          {
            type: "ADD_ALIAS",
            version: 1,
            timestamp: 1,
            userId: id,
            alias: a1,
          },
          {
            type: "REMOVE_ALIAS",
            version: 1,
            timestamp: 2,
            userId: id,
            alias: a1,
            retroactivePaid: "0",
          },
        ]);
      });
      it("errors if there's no matching user", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.removeAlias(randomUuid(), a1, 0),
          "removeAlias: no user matching id"
        );
      });
      it("throws an error if the user doesn't already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
        const thunk = () => ledger.removeAlias(id, a1, 0);
        failsWithoutMutation(ledger, thunk, "user does not have alias");
      });
      it("errors if the address is the user's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
        const innateAddress = userAddress(id);
        const thunk = () => ledger.removeAlias(id, innateAddress, 0);
        failsWithoutMutation(
          ledger,
          thunk,
          `removeAlias: cannot remove user's innate address`
        );
      });
      it("frees the alias to be re-added", () => {
        const ledger = new Ledger();
        const id1 = ledger.createUser("foo");
        const id2 = ledger.createUser("bar");
        ledger.addAlias(id1, a1);
        ledger.removeAlias(id1, a1, 0);
        ledger.addAlias(id2, a1);
        const u2 = ledger.userById(id2);
        expect(u2).toEqual({id: id2, name: "bar", aliases: [a1]});
      });
      it("errors on invalid credProportion", () => {
        const ledger = new Ledger();
        const id1 = ledger.createUser("foo");
        ledger.addAlias(id1, a1);
        for (const bad of [-0.3, 1.3, Infinity, NaN, -Infinity]) {
          failsWithoutMutation(
            ledger,
            () => ledger.removeAlias(id1, a1, bad),
            "invalid credProportion"
          );
        }
      });
      it("throws on unrecognized version", () => {
        // $FlowExpectedError
        expect(() => new Ledger()._removeAlias({version: 1337})).toThrowError(
          "unrecognized version"
        );
      });
    });
  });

  describe("canonicalAddress", () => {
    it("users' addresses are canonical", () => {
      const ledger = new Ledger();
      const id = ledger.createUser("foo");
      const addr = userAddress(id);
      expect(ledger.canonicalAddress(addr)).toEqual(addr);
    });
    it("hitherto unseen addresses are canonical", () => {
      const ledger = new Ledger();
      expect(ledger.canonicalAddress(a1)).toEqual(a1);
    });
    it("aliases are not canonical", () => {
      const ledger = new Ledger();
      const id = ledger.createUser("foo");
      ledger.addAlias(id, a1);
      const addr = userAddress(id);
      expect(ledger.canonicalAddress(a1)).toEqual(addr);
    });
    it("unlinked aliases are again canonical", () => {
      const ledger = new Ledger();
      const id = ledger.createUser("foo");
      ledger.addAlias(id, a1).removeAlias(id, a1, 0);
      expect(ledger.canonicalAddress(a1)).toEqual(a1);
    });
  });

  describe("grain accounts", () => {
    it("newly created users have an empty account", () => {
      const ledger = new Ledger();
      const userId = ledger.createUser("foo");
      const address = userAddress(userId);
      const account = ledger.accountByAddress(address);
      expect(account).toEqual({
        userId,
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
    it("non-user addresses can have accounts", () => {
      const ledger = new Ledger();
      ledger._allocateGrain(a1, g("10"));
      const account = ledger.accountByAddress(a1);
      expect(account).toEqual({
        userId: null,
        address: a1,
        balance: "10",
        paid: "10",
      });
      expect(ledger.accounts()).toEqual([account]);
    });
    it("accountByAddress returns canonical accounts", () => {
      const ledger = new Ledger();
      const userId = ledger.createUser("foo");
      const addr = userAddress(userId);
      ledger.addAlias(userId, a1);
      expect(ledger.accountByAddress(a1)).toEqual({
        // Note: we asked for `a1`, but got address `addr`.
        // This is intended behavior.
        address: addr,
        userId,
        paid: "0",
        balance: "0",
      });
    });
    it("when a user gets an alias, it claims the alias's balance", () => {
      const ledger = new Ledger();
      const userId = ledger.createUser("foo");
      const addr = userAddress(userId);
      ledger._allocateGrain(a1, g("1"));
      ledger._allocateGrain(addr, g("1"));
      ledger.addAlias(userId, a1);
      const userAccount = ledger.accountByAddress(addr);
      expect(userAccount).toEqual({
        userId,
        address: addr,
        paid: "2",
        balance: "2",
      });
      expect(ledger.accounts()).toEqual([userAccount]);
    });
    it("if an alias is allocated Grain, it's received by the canonical address", () => {
      const ledger = new Ledger();
      const userId = ledger.createUser("foo");
      const addr = userAddress(userId);
      ledger.addAlias(userId, a1);
      ledger._allocateGrain(a1, g("1"));
      ledger._allocateGrain(addr, g("1"));
      const userAccount = ledger.accountByAddress(addr);
      expect(userAccount).toEqual({
        userId,
        address: addr,
        paid: "2",
        balance: "2",
      });
      expect(ledger.accounts()).toEqual([userAccount]);
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
        const userId = ledger.createUser("foo");
        const addr = userAddress(userId);
        ledger.addAlias(userId, a1);
        ledger._allocateGrain(a1, g("100"));
        ledger.removeAlias(userId, a1, credProportion);
        const aliasAccount = ledger.accountByAddress(a1);
        expect(aliasAccount).toEqual({
          userId: null,
          address: a1,
          paid: expectedRetroactivePaid,
          balance: "0",
        });
        const userAccount = ledger.accountByAddress(addr);
        expect(userAccount).toEqual({
          userId,
          address: addr,
          paid: G.sub(g("100"), expectedRetroactivePaid),
          balance: "100",
        });
        expect(ledger.accounts()).toEqual([userAccount, aliasAccount]);
      }
    });
    it("removed aliases without retroactive payouts don't have an alias account", () => {
      const ledger = new Ledger();
      const userId = ledger.createUser("foo");
      const addr = userAddress(userId);
      ledger.addAlias(userId, a1);
      ledger._allocateGrain(a1, g("100"));
      ledger.removeAlias(userId, a1, 0);
      const aliasAccount = ledger.accountByAddress(a1);
      expect(aliasAccount).toEqual(undefined);
      const userAccount = ledger.accountByAddress(addr);
      expect(userAccount).toEqual({
        userId,
        address: addr,
        paid: "100",
        balance: "100",
      });
      expect(ledger.accounts()).toEqual([userAccount]);
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
      it("errors on an empty credHistory", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          () => ledger.distributeGrain([], []),
          "distributeGrain: empty cred history"
        );
      });
      it("produces an empty distribution if there are no policies", () => {
        setFakeDate(4);
        const ledger = new Ledger().distributeGrain([], credHistory);
        expect(ledger.actionLog()).toEqual([
          {
            type: "DISTRIBUTE_GRAIN",
            version: 1,
            timestamp: 4,
            credTimestamp: 3,
            allocations: [],
          },
        ]);
        expect(ledger.accounts()).toEqual([]);
      });
      it("errors if credHistory contains non-canonical addresses", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
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
          strategy: {type: "IMMEDIATE", version: 1},
        };
        setFakeDate(4);
        const ledger = new Ledger().distributeGrain([policy], credHistory);
        const account1 = ledger.accountByAddress(a1);
        const account2 = ledger.accountByAddress(a2);
        expect(account1).toEqual({
          address: a1,
          userId: null,
          balance: "0",
          paid: "0",
        });
        expect(account2).toEqual({
          address: a2,
          userId: null,
          balance: "10",
          paid: "10",
        });
        expect(ledger.actionLog()).toEqual([
          {
            type: "DISTRIBUTE_GRAIN",
            version: 1,
            credTimestamp: 3,
            timestamp: 4,
            allocations: [
              {
                strategy: policy.strategy,
                budget: policy.budget,
                version: 1,
                receipts: [
                  {address: a1, amount: "0"},
                  {address: a2, amount: "10"},
                ],
              },
            ],
          },
        ]);
      });
      it("computes a BALANCED allocation correctly", () => {
        const policy: DistributionPolicy = {
          budget: g("15"),
          strategy: {type: "BALANCED", version: 1},
        };
        setFakeDate(4);
        const ledger = new Ledger();
        // Give a2 some past payouts, so that the BALANCED
        // strategy should preferentially pay a1
        ledger._allocateGrain(a2, g("5"));
        ledger.distributeGrain([policy], credHistory);
        const account1 = ledger.accountByAddress(a1);
        const account2 = ledger.accountByAddress(a2);
        expect(account1).toEqual({
          address: a1,
          userId: null,
          balance: "10",
          paid: "10",
        });
        expect(account2).toEqual({
          address: a2,
          userId: null,
          balance: "10",
          paid: "10",
        });
        expect(ledger.actionLog()).toEqual([
          {
            type: "DISTRIBUTE_GRAIN",
            version: 1,
            credTimestamp: 3,
            timestamp: 4,
            allocations: [
              {
                strategy: policy.strategy,
                budget: policy.budget,
                version: 1,
                receipts: [
                  {address: a1, amount: "10"},
                  {address: a2, amount: "5"},
                ],
              },
            ],
          },
        ]);
      });
      it("order of the policies doesn't matter", () => {
        // We are not incrementally computing each allocation, applying it, and
        // then computing the next one.
        // Instead, we compute them all upfront, and then apply them.
        // This means that in the example below, the "BALANCED" policy doesn't
        // "know" about the payouts from the immediate policy, so someone can
        // get overpaid from the perspective of the balanced policy. This is OK
        // because it will get evened out by next week's BALANCED policy taking
        // this into account.
        const p1: DistributionPolicy = {
          budget: g("10"),
          strategy: {type: "BALANCED", version: 1},
        };
        const p2: DistributionPolicy = {
          budget: g("10"),
          strategy: {type: "IMMEDIATE", version: 1},
        };
        const ps1 = [p1, p2];
        const ps2 = [p2, p1];
        const l1 = new Ledger().distributeGrain(ps1, credHistory);
        const l2 = new Ledger().distributeGrain(ps2, credHistory);
        expect(l1.accounts()).toEqual(l2.accounts());
      });
      it("errors on unknown action version", () => {
        expect(() =>
          // $FlowExpectedError
          new Ledger()._distributeGrain({version: 1337})
        ).toThrowError("unknown DISTRIBUTE_GRAIN version: 1337");
      });
      it("errors on unknown allocation version", () => {
        expect(() =>
          new Ledger()._distributeGrain({
            version: 1,
            type: "DISTRIBUTE_GRAIN",
            timestamp: 4,
            credTimestamp: 9,
            // $FlowExpectedError
            allocations: [{version: 1337}],
          })
        ).toThrowError("unknown allocation version 1337");
      });
      it("BALANCED strategy accounts for unlinked aliases' retroactive paid", () => {
        // Sanity check since this property is important.
        const p: DistributionPolicy = {
          budget: g("7"),
          strategy: {type: "BALANCED", version: 1},
        };
        const ledger = new Ledger();
        setFakeDate(4);
        const userId = ledger.createUser("user");
        const aU = userAddress(userId);
        setFakeDate(5);
        ledger.addAlias(userId, a1);
        ledger._allocateGrain(aU, g("10"));
        setFakeDate(6);
        ledger.removeAlias(userId, a1, 0.5);
        setFakeDate(7);
        ledger.distributeGrain([p], credHistory);
        // From the perspective of the balanced payout: a1 and a2 have equal cred,
        // and a1 has a retroactive allotment of 5 Grain, so therefore from this payout,
        // 6 should go to a2, and 1 should go to a1, bringing them both to 6 Grain post-payout.
        const accountU = ledger.accountByAddress(aU);
        const account1 = ledger.accountByAddress(a1);
        const account2 = ledger.accountByAddress(a2);
        expect(accountU).toEqual({
          address: aU,
          userId,
          balance: "10",
          paid: "5",
        });
        expect(account1).toEqual({
          address: a1,
          userId: null,
          balance: "1",
          paid: "6",
        });
        expect(account2).toEqual({
          address: a2,
          userId: null,
          balance: "6",
          paid: "6",
        });
        expect(ledger.actionLog()).toEqual([
          {
            type: "CREATE_USER",
            username: "user",
            version: 1,
            timestamp: 4,
            userId,
          },
          {
            type: "ADD_ALIAS",
            version: 1,
            timestamp: 5,
            userId,
            alias: a1,
          },
          {
            type: "REMOVE_ALIAS",
            version: 1,
            timestamp: 6,
            userId,
            alias: a1,
            retroactivePaid: "5",
          },
          {
            type: "DISTRIBUTE_GRAIN",
            version: 1,
            credTimestamp: 3,
            timestamp: 7,
            allocations: [
              {
                strategy: p.strategy,
                budget: p.budget,
                version: 1,
                receipts: [
                  {address: a1, amount: "1"},
                  {address: a2, amount: "6"},
                ],
              },
            ],
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
          userId: null,
          paid: g("100"),
          balance: g("20"),
        };
        const e2 = {address: a2, userId: null, paid: g("5"), balance: g("85")};
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.actionLog()).toEqual([
          {
            type: "TRANSFER_GRAIN",
            version: 1,
            timestamp: 4,
            amount: "80",
            memo: "test",
            from: a1,
            to: a2,
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
          userId: null,
          paid: g("1"),
          balance: g("0"),
        };
        const e2 = {address: a2, userId: null, paid: g("0"), balance: g("1")};
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.actionLog()).toEqual([
          {
            type: "TRANSFER_GRAIN",
            version: 1,
            timestamp: 4,
            amount: "1",
            memo: "test",
            from: a1,
            to: a2,
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
          userId: null,
          paid: g("0"),
          balance: g("0"),
        };
        const e2 = {address: a2, userId: null, paid: g("0"), balance: g("0")};
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.actionLog()).toEqual([
          {
            type: "TRANSFER_GRAIN",
            version: 1,
            timestamp: 4,
            amount: "0",
            memo: "test",
            from: a1,
            to: a2,
          },
        ]);
      });
      it("if a transfer sends from an alias, the canonical account is debited", () => {
        const ledger = new Ledger();
        const userId = ledger.createUser("user");
        ledger.addAlias(userId, a1);
        ledger._allocateGrain(a1, g("1"));
        ledger.transferGrain({from: a1, to: a2, amount: g("1"), memo: "test"});
        const e1 = {
          address: userAddress(userId),
          userId,
          paid: g("1"),
          balance: g("0"),
        };
        const e2 = {address: a2, userId: null, paid: g("0"), balance: g("1")};
        expect(ledger.accountByAddress(a1)).toEqual(e1);
        expect(ledger.accountByAddress(a2)).toEqual(e2);
        expect(ledger.accounts()).toEqual([e1, e2]);
      });
      it("if a transfers sends to an alias, the canonical account is credited", () => {
        const ledger = new Ledger();
        const userId = ledger.createUser("user");
        ledger.addAlias(userId, a1);
        ledger._allocateGrain(a2, g("1"));
        ledger.transferGrain({from: a2, to: a1, amount: g("1"), memo: "test"});
        const e1 = {
          address: userAddress(userId),
          userId,
          paid: g("0"),
          balance: g("1"),
        };
        const e2 = {address: a2, userId: null, paid: g("1"), balance: g("0")};
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
          userId: null,
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
      it("fails for unknown transfer versions", () => {
        expect(() =>
          // $FlowExpectedError
          new Ledger()._transferGrain({version: 1337})
        ).toThrowError("unknown TRANSFER_GRAIN version: 1337");
      });
    });
  });

  describe("state reconstruction", () => {
    it("fromActionLog with an empty action log results in an empty ledger", () => {
      const emptyLog = new Ledger().actionLog();
      expect(emptyLog).toEqual([]);
      expect(Ledger.fromActionLog(emptyLog)).toEqual(new Ledger());
    });
    it("actionLog and fromActionLog compose to identity", () => {
      const ledger = new Ledger();
      const id1 = ledger.createUser("foo");
      const id2 = ledger.createUser("bar");
      ledger.addAlias(id1, a1);
      ledger.removeAlias(id1, a1, 0);
      ledger.addAlias(id2, a1);

      const ua1 = userAddress(id1);
      const ua2 = userAddress(id2);
      const policies = [
        {budget: g("400"), strategy: {type: "BALANCED", version: 1}},
        {budget: g("100"), strategy: {type: "IMMEDIATE", version: 1}},
      ];
      const credHistory = [
        {
          intervalEndMs: 10,
          cred: new Map([
            [ua1, 5],
            [ua2, 0],
          ]),
        },
        {
          intervalEndMs: 20,
          cred: new Map([
            [ua1, 3],
            [ua2, 7],
          ]),
        },
      ];
      ledger.distributeGrain(policies, credHistory);
      ledger.transferGrain({from: ua1, to: ua2, amount: g("10"), memo: null});
      expect(Ledger.fromActionLog(ledger.actionLog())).toEqual(ledger);
    });
  });
});
