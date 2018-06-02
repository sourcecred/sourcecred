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
    function graphRejectsNulls(f) {
      [null, undefined].forEach((bad) => {
        it(`${f.name} errors on ${String(bad)}`, () => {
          // $ExpectFlowError
          expect(() => f.call(new Graph(), bad)).toThrow(String(bad));
        });
      });
    }
    describe("node methods", () => {
      describe("error on", () => {
        const p = Graph.prototype;
        const nodeMethods = [p.addNode, p.removeNode, p.hasNode];
        function rejectsEdge(f) {
          it(`${f.name} rejects EdgeAddress`, () => {
            const e = Address.edgeAddress(["foo"]);
            // $ExpectFlowError
            expect(() => f.call(new Graph(), e)).toThrow("got EdgeAddress");
          });
        }
        nodeMethods.forEach(graphRejectsNulls);
        nodeMethods.forEach(rejectsEdge);
      });

      describe("work on", () => {
        const n1 = Address.nodeAddress(["foo"]);
        it("a graph with no nodes", () => {
          const graph = new Graph();
          expect(graph.hasNode(n1)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
        });
        it("a graph with a node added", () => {
          const graph = new Graph().addNode(n1);
          expect(graph.hasNode(n1)).toBe(true);
          expect(Array.from(graph.nodes())).toEqual([n1]);
        });
        it("a graph with the same node added twice", () => {
          const graph = new Graph().addNode(n1).addNode(n1);
          expect(graph.hasNode(n1)).toBe(true);
          expect(Array.from(graph.nodes())).toEqual([n1]);
        });
        it("a graph with an absent node removed", () => {
          const graph = new Graph().removeNode(n1);
          expect(graph.hasNode(n1)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
        });
        it("a graph with an added node removed", () => {
          const graph = new Graph().addNode(n1).removeNode(n1);
          expect(graph.hasNode(n1)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
        });
        it("a graph with an added node removed twice", () => {
          const graph = new Graph()
            .addNode(n1)
            .removeNode(n1)
            .removeNode(n1);
          expect(graph.hasNode(n1)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
        });
        it("a graph with two nodes", () => {
          const n2 = Address.nodeAddress([""]);
          const graph = new Graph().addNode(n1).addNode(n2);
          expect(graph.hasNode(n1)).toBe(true);
          expect(graph.hasNode(n2)).toBe(true);
          expect(Array.from(graph.nodes()).sort()).toEqual([n2, n1]);
        });
      });
    });
  });
});
