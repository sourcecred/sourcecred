// @flow

import deepFreeze from "deep-freeze";
import cloneDeep from "lodash.clonedeep";
import {fromString as uuidFromString} from "../util/uuid";
import {NodeAddress} from "../core/graph";
import {Ledger} from "./ledger";
import {usernameFromString, userAddress} from "./user";

describe("ledger/ledger", () => {
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

  const fooAddress = NodeAddress.fromParts(["foo"]);
  const foo = deepFreeze({
    id: uuidFromString("YVZhbGlkVXVpZEF0TGFzdA"),
    name: usernameFromString("foo"),
    aliases: [fooAddress],
  });
  const barAddress = NodeAddress.fromParts(["bar"]);
  const bar = deepFreeze({
    id: uuidFromString("XVZhbGlkVXVpZEF0TGFzdA"),
    name: usernameFromString("bar"),
    aliases: [barAddress],
  });
  const nameConflict = deepFreeze({
    id: foo.id,
    name: bar.name,
    aliases: foo.aliases,
  });
  const aliasConflict = deepFreeze({
    id: foo.id,
    name: foo.name,
    aliases: bar.aliases,
  });

  describe("user updates", () => {
    describe("addUser", () => {
      it("works", () => {
        const ledger = new Ledger().addUser(foo);
        expect(ledger.users()).toEqual([foo]);
      });
      it("is idempotent", () => {
        const ledger = new Ledger().addUser(foo).addUser(foo);
        expect(ledger.users()).toEqual([foo]);
      });
      it("fails if the user's name is taken by another user", () => {
        const ledger = new Ledger().addUser(bar);
        failsWithoutMutation(
          ledger,
          (l) => l.addUser(nameConflict),
          "addUser: username already claimed"
        );
      });
      it("fails if one of the user's aliases is already claimed", () => {
        const ledger = new Ledger().addUser(bar);
        failsWithoutMutation(
          ledger,
          (l) => l.addUser(aliasConflict),
          "addUser: alias already claimed"
        );
      });
      it("fails if a different user exists at that id", () => {
        const ledger = new Ledger().addUser(foo);
        failsWithoutMutation(
          ledger,
          (l) => l.addUser(aliasConflict),
          "addUser: conflicting user with id"
        );
      });
      it("fails if the user's own innate address is already taken", () => {
        // Weird edge case where another user has been explicitly linked to the
        // new user's innate address
        const ledger = new Ledger()
          .addUser(foo)
          .addAlias(foo.id, userAddress(bar.id));
        failsWithoutMutation(
          ledger,
          (l) => l.addUser(bar),
          "addUser: innate address already claimed"
        );
      });
    });

    describe("renameUser", () => {
      it("works", () => {
        const ledger = new Ledger().addUser(foo).renameUser(foo.id, bar.name);
        const expected = {id: foo.id, name: bar.name, aliases: foo.aliases};
        expect(ledger.users()).toEqual([expected]);
      });
      it("is idempotent", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .renameUser(foo.id, bar.name)
          .renameUser(foo.id, bar.name);
        const expected = {id: foo.id, name: bar.name, aliases: foo.aliases};
        expect(ledger.users()).toEqual([expected]);
      });
      it("fails on nonexistent user id", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.renameUser(foo.id, bar.name),
          "renameUser: no user matches id"
        );
      });
      it("fails on username conflict", () => {
        const thunk = () =>
          new Ledger().addUser(foo).addUser(bar).renameUser(foo.id, bar.name);
        expect(thunk).toThrowError("renameUser: conflict on username bar");
      });
    });

    describe("removeUser", () => {
      it("works", () => {
        const ledger = new Ledger().addUser(foo).removeUser(foo.id);
        expect(ledger.users()).toEqual([]);
      });
      it("is idempotent", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .removeUser(foo.id)
          .removeUser(foo.id);
        expect(ledger.users()).toEqual([]);
      });
      it("frees up the username", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .removeUser(foo.id)
          .addUser(nameConflict);
        expect(ledger.users()).toEqual([nameConflict]);
      });
      it("frees up the aliases", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .removeUser(foo.id)
          .addUser(aliasConflict);
        expect(ledger.users()).toEqual([aliasConflict]);
      });
      it("frees up the user's innate address", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .addUser(bar)
          .removeUser(foo.id)
          .addAlias(bar.id, userAddress(foo.id));
        expect(ledger.users()).toEqual([
          {
            id: bar.id,
            name: bar.name,
            aliases: [barAddress, userAddress(foo.id)],
          },
        ]);
      });
      it("removed useres may be re-added", () => {
        // Verifies that we are cleaning the innate address from the list of
        // restricted addresses when we remove the user.
        const ledger = new Ledger()
          .addUser(foo)
          .removeUser(foo.id)
          .addUser(foo);
        expect(ledger.users()).toEqual([foo]);
      });
    });

    describe("addAlias", () => {
      it("works", () => {
        const ledger = new Ledger().addUser(foo).addAlias(foo.id, barAddress);
        const expected = {
          id: foo.id,
          name: foo.name,
          aliases: [fooAddress, barAddress],
        };
        expect(ledger.users()).toEqual([expected]);
      });
      it("is idemptoent", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .addAlias(foo.id, barAddress)
          .addAlias(foo.id, barAddress);
        const expected = {
          id: foo.id,
          name: foo.name,
          aliases: [fooAddress, barAddress],
        };
        expect(ledger.users()).toEqual([expected]);
      });
      it("errors if there's no matching user", () => {
        const ledger = new Ledger().addUser(foo);
        failsWithoutMutation(
          ledger,
          (l) => l.addAlias(bar.id, barAddress),
          "addAlias: no matching userId"
        );
      });
      it("errors if the address is another user's innate address", () => {
        const ledger = new Ledger().addUser(foo).addUser(bar);
        const innateAddress = userAddress(foo.id);
        failsWithoutMutation(
          ledger,
          (l) => l.addAlias(bar.id, innateAddress),
          `addAlias: alias ${NodeAddress.toString(innateAddress)} already bound`
        );
      });
      it("errors if the address is another user's alias", () => {
        const ledger = new Ledger().addUser(foo).addUser(bar);
        failsWithoutMutation(
          ledger,
          (l) => l.addAlias(bar.id, fooAddress),
          `addAlias: alias ${NodeAddress.toString(fooAddress)} already bound`
        );
      });
    });

    describe("removeAlias", () => {
      it("works", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .removeAlias(foo.id, fooAddress);
        const expected = {
          id: foo.id,
          name: foo.name,
          aliases: [],
        };
        expect(ledger.users()).toEqual([expected]);
      });
      it("is idempotent", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .removeAlias(foo.id, fooAddress)
          .removeAlias(foo.id, fooAddress);
        const expected = {
          id: foo.id,
          name: foo.name,
          aliases: [],
        };
        expect(ledger.users()).toEqual([expected]);
      });
      it("errors if there's no matching user", () => {
        const ledger = new Ledger();
        failsWithoutMutation(
          ledger,
          (l) => l.removeAlias(foo.id, fooAddress),
          "removeAlias: no user matching id"
        );
      });
      it("errors if the address is the user's innate address", () => {
        const ledger = new Ledger().addUser(foo);
        failsWithoutMutation(
          ledger,
          (l) => l.removeAlias(foo.id, userAddress(foo.id)),
          "removeAlias: cannot remove user's innate address"
        );
      });
      it("frees the alias so it may be re-added", () => {
        const ledger = new Ledger()
          .addUser(foo)
          .addUser(bar)
          .removeAlias(foo.id, fooAddress)
          .addAlias(bar.id, fooAddress);
        const expectedFoo = {id: foo.id, name: foo.name, aliases: []};
        const expectedBar = {
          id: bar.id,
          name: bar.name,
          aliases: [barAddress, fooAddress],
        };
        expect(ledger.users()).toEqual([expectedFoo, expectedBar]);
      });
    });
  });

  describe("user getters", () => {
    it("userById works", () => {
      const ledger = new Ledger().addUser(foo);
      expect(ledger.userById(foo.id)).toEqual(foo);
      expect(ledger.userById(bar.id)).toEqual(undefined);
    });
    it("userByUsername works", () => {
      const ledger = new Ledger().addUser(foo);
      expect(ledger.userByUsername(foo.name)).toEqual(foo);
      expect(ledger.userByUsername(bar.name)).toEqual(undefined);
      ledger.renameUser(foo.id, bar.name);
      expect(ledger.userByUsername(foo.name)).toEqual(undefined);
      expect(ledger.userByUsername(bar.name)).toEqual({
        id: foo.id,
        name: bar.name,
        aliases: foo.aliases,
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
      const ledger = new Ledger()
        .addUser(foo)
        .addUser(bar)
        .removeAlias(foo.id, fooAddress)
        .removeUser(bar.id)
        .addAlias(foo.id, barAddress);
      expect(Ledger.fromActionLog(ledger.actionLog())).toEqual(ledger);
    });
  });
});
