// @flow

import {
  toNodeAddress,
  fromNodeAddress,
  toEdgeAddress,
  fromEdgeAddress,
  Graph,
} from "./graph";

describe("core/graph", () => {
  describe("address functions", () => {
    function throwOnNullOrUndefined(f) {
      [null, undefined].forEach((bad) => {
        it(`${f.name} throws on ${String(bad)}`, () => {
          // $ExpectFlowError
          expect(() => f(bad)).toThrow(String(bad));
        });
      });
    }

    describe("toNodeAddress & fromNodeAddress", () => {
      throwOnNullOrUndefined(toNodeAddress);
      throwOnNullOrUndefined(fromNodeAddress);
      it("toNodeAddress errors on path containing NUL char", () => {
        expect(() => toNodeAddress(["foo", "bar\0", "zoink"])).toThrow(
          "NUL char"
        );
      });
      [null, undefined].forEach((bad) => {
        it(`toNodeAddress errors on path containing ${String(bad)}`, () => {
          // $ExpectFlowError
          expect(() => toNodeAddress(["foo", bad, "zoink"])).toThrow(
            String(bad)
          );
        });
      });
      describe("compose to identity", () => {
        function checkIdentity(name, example) {
          it(name, () => {
            expect(fromNodeAddress(toNodeAddress(example))).toEqual(example);
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
      it("fromNodeAddress errors if passed an edge address", () => {
        // $ExpectFlowError
        expect(() => fromNodeAddress(toEdgeAddress(["ex"]))).toThrow(
          "EdgeAddress"
        );
      });
      it("fromNodeAddress errors if passed a malformed string", () => {
        // $ExpectFlowError
        expect(() => fromNodeAddress("N/foo")).toThrow("Malformed");
      });
    });

    describe("toEdgeAddress & fromEdgeAddress", () => {
      throwOnNullOrUndefined(toEdgeAddress);
      throwOnNullOrUndefined(fromEdgeAddress);
      it("toEdgeAddress errors on path containing NUL char", () => {
        expect(() => toEdgeAddress(["foo", "bar\0", "zoink"])).toThrow(
          "NUL char"
        );
      });
      [null, undefined].forEach((bad) => {
        it(`toEdgeAddress errors on path containing ${String(bad)}`, () => {
          // $ExpectFlowError
          expect(() => toEdgeAddress(["foo", bad, "zoink"])).toThrow(
            String(bad)
          );
        });
      });
      describe("compose to identity", () => {
        function checkIdentity(name, example) {
          it(name, () => {
            expect(fromEdgeAddress(toEdgeAddress(example))).toEqual(example);
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
      it("fromEdgeAddress errors if passed an node address", () => {
        // $ExpectFlowError
        expect(() => fromEdgeAddress(toNodeAddress(["ex"]))).toThrow(
          "NodeAddress"
        );
      });
      it("fromEdgeAddress errors if passed a malformed string", () => {
        // $ExpectFlowError
        expect(() => fromEdgeAddress("E/foo")).toThrow("Malformed");
      });
    });

    it("edge and node addresses are distinct", () => {
      expect(toEdgeAddress([""])).not.toEqual(toNodeAddress([""]));
      expect(toEdgeAddress(["foo"])).not.toEqual(toNodeAddress(["foo"]));
    });
  });

  describe("Graph class", () => {
    it("can be constructed", () => {
      const x = new Graph();
      // Verify that `x` is not of type `any`
      // $ExpectFlowError
      expect(() => x.measureSpectacularity()).toThrow();
    });
  });
});
