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
    it("returns an object with read-only properties", () => {
      const {FooAddress} = makeModules();
      expect(() => {
        // $ExpectFlowError
        FooAddress.assertValid = FooAddress.assertValid;
      }).toThrow(/read.only property/);
    });
  });
});
