// @flow

import {
  type EdgeAddress,
  type NodeAddress,
  type _EdgeAddressT,
  type _NodeAddressT,
  Address,
  Direction,
  Graph,
  edgeToString,
} from "./graph";

describe("core/graph", () => {
  const {nodeAddress, edgeAddress} = Address;
  describe("Address re-exports", () => {
    it("exist", () => {
      expect(Address).toEqual(expect.anything());
    });
    it("include distinct NodeAddress and EdgeAddress types", () => {
      const node: NodeAddress = nodeAddress([]);
      const edge: EdgeAddress = edgeAddress([]);
      // $ExpectFlowError
      const _unused_badNodeAddress: NodeAddress = edge;
      // $ExpectFlowError
      const _unused_badEdgeAddress: EdgeAddress = node;
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

  function _unused_itExportsDistinctNodeAddressAndEdgeAddressTypes() {
    // $ExpectFlowError
    const _unused_nodeToEdge = (x: _NodeAddressT): _EdgeAddressT => x;
    // $ExpectFlowError
    const _unused_edgeToNode = (x: _EdgeAddressT): _NodeAddressT => x;
  }

  describe("Direction values", () => {
    it("are read-only", () => {
      expect(() => {
        // $ExpectFlowError
        Direction.IN = Direction.OUT;
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
        describe("null/undefined", () => {
          nodeMethods.forEach(graphRejectsNulls);
        });
        describe("edge addresses", () => {
          function rejectsEdgeAddress(f) {
            it(`${f.name} rejects EdgeAddress`, () => {
              const e = edgeAddress(["foo"]);
              // $ExpectFlowError
              expect(() => f.call(new Graph(), e)).toThrow("got EdgeAddress");
            });
          }
          nodeMethods.forEach(rejectsEdgeAddress);
        });
        describe("remove a node that is some edge's", () => {
          const src = nodeAddress(["src"]);
          const dst = nodeAddress(["dst"]);
          const address = edgeAddress(["edge"]);
          const edge = () => ({src, dst, address});
          const graph = () =>
            new Graph()
              .addNode(src)
              .addNode(dst)
              .addEdge(edge());
          it("src", () => {
            expect(() => graph().removeNode(src)).toThrow(
              "Attempted to remove src of"
            );
          });
          it("dst", () => {
            expect(() => graph().removeNode(dst)).toThrow(
              "Attempted to remove dst of"
            );
          });
        });
      });

      describe("work on", () => {
        const n1 = nodeAddress(["foo"]);
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
          const n2 = nodeAddress([""]);
          const graph = new Graph().addNode(n1).addNode(n2);
          expect(graph.hasNode(n1)).toBe(true);
          expect(graph.hasNode(n2)).toBe(true);
          expect(Array.from(graph.nodes()).sort()).toEqual([n2, n1]);
        });
      });
    });

    describe("edge methods", () => {
      const edgeArray = (g: Graph) => Array.from(g.edges());
      describe("error on", () => {
        const p = Graph.prototype;
        const edgeAddrMethods = [p.removeEdge, p.hasEdge, p.edge];
        describe("null/undefined", () => {
          edgeAddrMethods.forEach(graphRejectsNulls);
          graphRejectsNulls(p.addEdge);
        });
        describe("node addresses", () => {
          function rejectsNodeAddress(f) {
            it(`${f.name} rejects NodeAddress`, () => {
              const e = nodeAddress(["foo"]);
              // $ExpectFlowError
              expect(() => f.call(new Graph(), e)).toThrow("got NodeAddress");
            });
          }
          edgeAddrMethods.forEach(rejectsNodeAddress);
        });

        describe("addEdge edge validation", () => {
          describe("throws on absent", () => {
            const src = nodeAddress(["src"]);
            const dst = nodeAddress(["dst"]);
            const address = edgeAddress(["hi"]);
            it("src", () => {
              expect(() =>
                new Graph().addNode(dst).addEdge({src, dst, address})
              ).toThrow("Missing src");
            });
            it("dst", () => {
              expect(() =>
                new Graph().addNode(src).addEdge({src, dst, address})
              ).toThrow("Missing dst");
            });
          });

          describe("throws on edge with", () => {
            const n = nodeAddress(["foo"]);
            const e = edgeAddress(["bar"]);
            const x = "foomlio";
            const badEdges = [
              {
                what: "malformed src",
                edge: {src: x, dst: n, address: e},
                msg: "edge.src",
              },
              {
                what: "edge address for src",
                edge: {src: e, dst: n, address: e},
                msg: "edge.src",
              },
              {
                what: "malformed dst",
                edge: {src: n, dst: x, address: e},
                msg: "edge.dst",
              },
              {
                what: "edge address for dst",
                edge: {src: n, dst: e, address: e},
                msg: "edge.dst",
              },
              {
                what: "malformed address",
                edge: {src: n, dst: n, address: x},
                msg: "edge.address",
              },
              {
                what: "node address for address",
                edge: {src: n, dst: n, address: n},
                msg: "edge.address",
              },
            ];
            badEdges.forEach(({what, edge, msg}) => {
              it(what, () => {
                const graph = new Graph().addNode(n);
                // $ExpectFlowError
                expect(() => graph.addEdge(edge)).toThrow(msg);
              });
            });
          });
        });
      });

      describe("on a graph", () => {
        const src = nodeAddress(["foo"]);
        const dst = nodeAddress(["bar"]);
        const address = edgeAddress(["yay"]);

        describe("that has no edges or nodes", () => {
          it("`hasEdge` is false for some address", () => {
            expect(new Graph().hasEdge(address)).toBe(false);
          });
          it("`edge` is undefined for some address", () => {
            expect(new Graph().edge(address)).toBe(undefined);
          });
          it("`edges` is empty", () => {
            expect(edgeArray(new Graph())).toHaveLength(0);
          });
        });

        describe("with just one edge", () => {
          const graph = () =>
            new Graph()
              .addNode(src)
              .addNode(dst)
              .addEdge({src, dst, address});
          it("`hasEdge` can discover the edge", () => {
            expect(graph().hasEdge(address)).toBe(true);
          });
          it("`edge` can retrieve the edge", () => {
            expect(graph().edge(address)).toEqual({src, dst, address});
          });
          it("`edges` contains the edge", () => {
            const edgeArray = (g: Graph) => Array.from(g.edges());
            expect(edgeArray(graph())).toEqual([{src, dst, address}]);
          });
        });

        describe("with edge added and removed", () => {
          const graph = () =>
            new Graph()
              .addNode(src)
              .addNode(dst)
              .addEdge({src, dst, address})
              .removeEdge(address);
          it("`hasEdge` now returns false", () => {
            expect(graph().hasEdge(address)).toBe(false);
          });
          it("`edge` returns undefined", () => {
            expect(graph().edge(address)).toBe(undefined);
          });
          it("`edges` is empty", () => {
            expect(edgeArray(graph())).toHaveLength(0);
          });
          it("nodes were not removed", () => {
            expect(graph().hasNode(src)).toBe(true);
            expect(graph().hasNode(dst)).toBe(true);
            expect(Array.from(graph().nodes())).toHaveLength(2);
          });
        });

        describe("with multiple loop edges", () => {
          const e1 = edgeAddress(["e1"]);
          const e2 = edgeAddress(["e2"]);
          const edge1 = {src, dst: src, address: e1};
          const edge2 = {src, dst: src, address: e2};
          const quiver = () =>
            new Graph()
              .addNode(src)
              .addEdge(edge1)
              .addEdge(edge2);
          it("adding multiple loop edges throws no error", () => {
            quiver();
          });
          it("both edges are discoverable via `hasEdge`", () => {
            expect(quiver().hasEdge(e1)).toBe(true);
            expect(quiver().hasEdge(e2)).toBe(true);
          });
          it("both edges are retrievable via `edge`", () => {
            expect(quiver().edge(e1)).toEqual(edge1);
            expect(quiver().edge(e2)).toEqual(edge2);
          });
          it("both edges are retrievable from `edges`", () => {
            expect(edgeArray(quiver()).sort()).toEqual([edge1, edge2].sort());
          });
        });
      });

      describe("idempotency of", () => {
        const src = nodeAddress(["src"]);
        const dst = nodeAddress(["dst"]);
        const address = edgeAddress(["hi"]);
        it("`addEdge`", () => {
          const g = new Graph()
            .addNode(src)
            .addNode(dst)
            .addEdge({src, dst, address})
            .addEdge({src, dst, address});
          expect(edgeArray(g)).toEqual([{src, dst, address}]);
        });
        it("`removeEdge`", () => {
          const g = new Graph()
            .addNode(src)
            .addNode(dst)
            .addEdge({src, dst, address})
            .removeEdge(address)
            .removeEdge(address);
          expect(edgeArray(g)).toHaveLength(0);
        });
      });
    });
  });

  describe("edgeToString", () => {
    it("works", () => {
      const edge = {
        address: Address.edgeAddress(["one", "two"]),
        dst: Address.nodeAddress(["five", "six"]),
        src: Address.nodeAddress(["three", "four"]),
      };
      const expected =
        "{" +
        'address: edgeAddress(["one","two"]), ' +
        'src: nodeAddress(["three","four"]), ' +
        'dst: nodeAddress(["five","six"])' +
        "}";
      expect(edgeToString(edge)).toEqual(expected);
    });
  });
});
