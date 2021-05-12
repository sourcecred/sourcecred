// @flow

import {get} from "../../util/null";
import {Ledger} from "../../core/ledger/ledger";
import {_hackyIdentityNameReferenceDetector} from "./graph";

describe("api/main/graph", () => {
  describe("hacky reference detector", () => {
    it("works", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "steven");
      const {identity} = get(ledger.account(id));
      const {addressFromUrl} = _hackyIdentityNameReferenceDetector(ledger);
      expect(addressFromUrl("steven")).toEqual(identity.address);
      expect(addressFromUrl("Steven")).toEqual(identity.address);
      expect(addressFromUrl("@steven")).toEqual(identity.address);
      expect(addressFromUrl("@Steven")).toEqual(identity.address);
      expect(addressFromUrl("stuball")).toEqual(undefined);
    });
    it("works when username in ledger is capitalized", () => {
      const ledger = new Ledger();
      const id = ledger.createIdentity("USER", "Steven");
      const {identity} = get(ledger.account(id));
      const {addressFromUrl} = _hackyIdentityNameReferenceDetector(ledger);
      expect(addressFromUrl("steven")).toEqual(identity.address);
      expect(addressFromUrl("Steven")).toEqual(identity.address);
      expect(addressFromUrl("@steven")).toEqual(identity.address);
      expect(addressFromUrl("@Steven")).toEqual(identity.address);
      expect(addressFromUrl("stuball")).toEqual(undefined);
    });
  });
});
