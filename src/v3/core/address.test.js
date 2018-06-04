// @flow

import {_Address, assertNodeAddress, assertEdgeAddress} from "./address";

describe("core/address", () => {
  const {nodeAddress, edgeAddress, toParts} = _Address;
  function throwOnNullOrUndefined(f) {
    [null, undefined].forEach((bad) => {
      it(`${f.name} throws on ${String(bad)}`, () => {
        // $ExpectFlowError
        expect(() => f(bad)).toThrow(String(bad));
      });
    });
  }

  function checkAddressFactory(f) {
    describe(f.name, () => {
      it("creates a base address when called without arguments", () => {
        const base = f();
        expect(typeof base).toEqual("string");
      });
      it("throws an error when called with explicit null", () => {
        // $ExpectFlowError
        expect(() => f(null)).toThrowError("null");
      });
      it("creates a base address when called with explicit undefined", () => {
        expect(f(undefined)).toEqual(f());
      });
      it("creates a base address when called with empty list", () => {
        expect(f()).toEqual(f([]));
      });
      [null, undefined].forEach((bad) => {
        it(`throws on parts containing ${String(bad)}`, () => {
          // $ExpectFlowError
          expect(() => f(["foo", bad])).toThrow(String(bad));
        });
      });
      describe("composes to identity with toParts", () => {
        function checkIdentity(name, example) {
          it(name, () => {
            expect(toParts(f(example))).toEqual(example);
          });
        }

        checkIdentity("on a simple example", ["an", "example"]);
        describe("with an empty component", () => {
          checkIdentity("at the start", ["", "example"]);
          checkIdentity("in the middle", ["example", "", "foo"]);
          checkIdentity("at the end", ["example", "", "foo", ""]);
        });
        checkIdentity("with an empty array", []);
      });
    });
  }
  checkAddressFactory(nodeAddress);
  checkAddressFactory(edgeAddress);

  describe("toParts", () => {
    throwOnNullOrUndefined(toParts);
    it("throws on malformed address", () => {
      // $ExpectFlowError
      expect(() => toParts("zookomoobo")).toThrow("Expected Address");
    });
  });

  describe("node and edge addresses are distinct", () => {
    it("at a type level", () => {
      // $ExpectFlowError
      const _unused_edgeAddress: _EdgeAddress = nodeAddress();
      // $ExpectFlowError
      const _unused_nodeAddress: _NodeAddress = edgeAddress();
    });
    describe("at a value level", () => {
      it("base address", () => {
        expect(nodeAddress()).not.toEqual(edgeAddress());
      });
      it("normal address", () => {
        expect(nodeAddress(["foo"])).not.toEqual(edgeAddress(["foo"]));
      });
    });
  });

  describe("type assertions", () => {
    function checkAssertion(f, good, bad, badMsg) {
      describe(f.name, () => {
        it("does not error on the right type of address", () => {
          // Technically, the below invocation isn't an error; but no need to
          // persuade Flow of this, as we already check that Node/Edge
          // addresses are handled correctly by flow in a different test case.
          f((good: any));
        });
        throwOnNullOrUndefined(f);
        it("errors on the wrong type of address", () => {
          // $ExpectFlowError
          expect(() => f(bad)).toThrow(badMsg);
        });
        it("errors on non-address", () => {
          // $ExpectFlowError
          expect(() => f("foomulous")).toThrow("Bad address:");
        });
      });
    }
    checkAssertion(
      assertNodeAddress,
      nodeAddress(),
      edgeAddress(),
      "got EdgeAddress"
    );
    checkAssertion(
      assertEdgeAddress,
      edgeAddress(),
      nodeAddress(),
      "got NodeAddress"
    );
  });
});
