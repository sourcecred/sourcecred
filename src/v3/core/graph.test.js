// @flow

import {Address, Graph} from "./graph";
import type {NodeAddress, EdgeAddress} from "./graph";

describe("core/graph", () => {
  describe("Address re-exports", () => {
    it("exist", () => {
      expect(Address).toEqual(expect.anything());
    });
    it("include distinct NodeAddress and EdgeAddress types", () => {
      const nodeAddress: NodeAddress = Address.nodeAddress([]);
      const edgeAddress: EdgeAddress = Address.edgeAddress([]);
      // $ExpectFlowError
      const badNodeAddress: NodeAddress = edgeAddress;
      // $ExpectFlowError
      const badEdgeAddress: EdgeAddress = nodeAddress;
      const _ = {badNodeAddress, badEdgeAddress};
    });
    it("are read-only", () => {
      const originalToParts = Address.toParts;
      const wonkyToParts: typeof originalToParts = (a) => [
        ...originalToParts(a),
        "wat",
      ];
      expect(() => {
        // $ExpectFlowError
        Address.toParts = wonkyToParts;
      }).toThrow(/read.only property/);
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
