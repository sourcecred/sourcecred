// @flow

import cloneDeep from "lodash.clonedeep";
import {random as randomUuid} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {Ledger} from "./ledger";
import {userAddress} from "./user";

describe("ledger/ledger", () => {
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
        ledger.removeAlias(id, a1);
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
          },
        ]);
      });
      it("errors if there's no matching user", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.removeAlias(randomUuid(), a1),
          "removeAlias: no user matching id"
        );
      });
      it("throws an error if the user doesn't already has that alias", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
        const thunk = () => ledger.removeAlias(id, a1);
        failsWithoutMutation(ledger, thunk, "user does not have alias");
      });
      it("errors if the address is the user's innate address", () => {
        const ledger = new Ledger();
        const id = ledger.createUser("foo");
        const innateAddress = userAddress(id);
        const thunk = () => ledger.removeAlias(id, innateAddress);
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
        ledger.removeAlias(id1, a1);
        ledger.addAlias(id2, a1);
        const u2 = ledger.userById(id2);
        expect(u2).toEqual({id: id2, name: "bar", aliases: [a1]});
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
      ledger.addAlias(id, a1).removeAlias(id, a1);
      expect(ledger.canonicalAddress(a1)).toEqual(a1);
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
      ledger.removeAlias(id1, a1);
      ledger.addAlias(id2, a1);
      expect(Ledger.fromActionLog(ledger.actionLog())).toEqual(ledger);
    });
  });
});
