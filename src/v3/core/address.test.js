// @flow

import {makeAddressModule} from "./address";

describe("core/address", () => {
  describe("makeAddressModule", () => {
    const makeModules = () => ({
      FooAddress: makeAddressModule({
        name: "FooAddress",
        nonce: "F",
        otherNonces: new Map().set("B", "BarAddress"),
      }),
      BarAddress: makeAddressModule({
        name: "BarAddress",
        nonce: "B",
        otherNonces: new Map().set("F", "FooAddress"),
      }),
      WatAddress: makeAddressModule({
        name: "WatAddress",
        nonce: "W",
        otherNonces: new Map(),
      }),
    });

    it("makes an address module given the mandatory options", () => {
      makeAddressModule({name: "FooAddress", nonce: "F"});
    });
    it("makes address modules using all the options", () => {
      makeModules();
    });
    it("rejects a module whose nonce contains NUL", () => {
      expect(() => {
        makeAddressModule({name: "BadAddress", nonce: "n\0o"});
      }).toThrow("invalid nonce (contains NUL):");
    });
    it("rejects a module with `otherNonces` containing NUL", () => {
      expect(() => {
        makeAddressModule({
          name: "GoodAddress",
          nonce: "G",
          otherNonces: new Map().set("n\0o", "BadAddress"),
        });
      }).toThrow("invalid otherNonce (contains NUL):");
    });
    it("rejects a module with `nonce` in `otherNonces`", () => {
      expect(() => {
        makeAddressModule({
          name: "GoodAddress",
          nonce: "G",
          otherNonces: new Map().set("G", "WatAddress"),
        });
      }).toThrow("primary nonce listed as otherNonce");
    });
    it("returns an object with read-only properties", () => {
      const {FooAddress} = makeModules();
      expect(() => {
        // $ExpectFlowError
        FooAddress.assertValid = FooAddress.assertValid;
      }).toThrow(/read.only property/);
    });
  });
});
