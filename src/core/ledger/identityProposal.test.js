// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress} from "../graph";
import {Ledger} from "./ledger";
import {nameFromString} from "../identity";
import {ensureIdentityExists, _chooseIdentityName} from "./identityProposal";

describe("core/ledger/identityProposal", () => {
  const alias = {description: "example", address: NodeAddress.empty};
  const proposal = deepFreeze({
    name: nameFromString("foo"),
    pluginName: nameFromString("bar"),
    alias,
    type: "USER",
  });
  describe("ensureIdentityExists", () => {
    it("doesn't mutate the ledger if the address is already taken", () => {
      const ledger = new Ledger();
      const address = NodeAddress.empty;
      const id = ledger.createIdentity("USER", "foo");
      ledger.addAlias(id, alias);
      const log = ledger.eventLog();
      const otherAlias = {description: "different description", address};
      const proposal = {
        name: nameFromString("foo"),
        pluginName: nameFromString("bar"),
        alias: otherAlias,
        type: "USER",
      };
      ensureIdentityExists(ledger, proposal);
      // Verify that the ledger didn't mutate.
      expect(ledger.eventLog()).toEqual(log);
    });
    it("creates a new identity (with alias) if address isn't taken", () => {
      const ledger = new Ledger();
      ensureIdentityExists(ledger, proposal);
      const account = ledger.accountByAddress(alias.address);
      if (account == null) {
        throw new Error("identity not created");
      }
      expect(account.identity.name).toEqual(proposal.name);
      expect(account.identity.aliases).toEqual([alias]);
    });
    it("uses the discriminator logic from _chooseIdentityName if needed", () => {
      const ledger = new Ledger();
      ledger.createIdentity("USER", "foo");
      ensureIdentityExists(ledger, proposal);
      const account = ledger.accountByAddress(alias.address);
      if (account == null) {
        throw new Error("identity not created");
      }
      expect(account.identity.name).toEqual("foo-bar");
      expect(account.identity.aliases).toEqual([alias]);
    });
    it("creates an identity with the correct type", () => {
      for (const type of ["USER", "PROJECT", "ORGANIZATION", "BOT"]) {
        const ledger = new Ledger();
        const typedProposal = {
          name: nameFromString("foo"),
          pluginName: nameFromString("bar"),
          alias,
          type,
        };
        ensureIdentityExists(ledger, typedProposal);
        const account = ledger.accountByAddress(alias.address);
        if (account == null) {
          throw new Error("identity not created");
        }
        expect(account.identity.subtype).toEqual(type);
      }
    });
  });
  describe("_chooseIdentityName", () => {
    it("returns the default name if available", () => {
      function checkAvailable() {
        return true;
      }
      expect(_chooseIdentityName(proposal, checkAvailable)).toEqual("foo");
    });
    it("adds a plugin discriminator if needed", () => {
      function checkAvailable(n) {
        return n !== "foo";
      }
      expect(_chooseIdentityName(proposal, checkAvailable)).toEqual("foo-bar");
    });
    it("adds a further numeric discriminator if needed", () => {
      function checkAvailable(n) {
        // $FlowExpectedError[incompatible-type]
        return n !== "foo" && n !== "foo-bar";
      }
      expect(_chooseIdentityName(proposal, checkAvailable)).toEqual(
        "foo-bar-1"
      );
    });
    it("increments the numeric discriminator if needed", () => {
      function checkAvailable(n) {
        // $FlowExpectedError[incompatible-type]
        return n !== "foo" && n !== "foo-bar" && n !== "foo-bar-1";
      }
      expect(_chooseIdentityName(proposal, checkAvailable)).toEqual(
        "foo-bar-2"
      );
    });
    it("fails if it can't find any valid discriminator after many tries", () => {
      function checkAvailable() {
        return false;
      }
      const thunk = () => _chooseIdentityName(proposal, checkAvailable);
      expect(thunk).toThrowError("unable to find an identity name");
    });
  });
});
