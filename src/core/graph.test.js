// @flow

import sortBy from "lodash.sortby";

import {
  type Edge,
  type EdgeAddressT,
  type EdgesOptions,
  type Neighbor,
  type NeighborsOptions,
  type NodeAddressT,
  Direction,
  EdgeAddress,
  Graph,
  NodeAddress,
  edgeToString,
  edgeToStrings,
  edgeToParts,
  sortedEdgeAddressesFromJSON,
  sortedNodeAddressesFromJSON,
} from "./graph";
import {advancedGraph} from "./graphTestUtil";

describe("core/graph", () => {
  function _unused_itExportsDistinctNodeAddressAndEdgeAddressTypes() {
    // $ExpectFlowError
    const _unused_nodeToEdge = (x: NodeAddressT): EdgeAddressT => x;
    // $ExpectFlowError
    const _unused_edgeToNode = (x: EdgeAddressT): NodeAddressT => x;
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

    it("throws when trying to perform an unsafe number of modifications", () => {
      const g = new Graph();
      g.addNode(NodeAddress.fromParts(["one"]));
      g.addNode(NodeAddress.fromParts(["two"]));
      // skip a few
      g._modificationCount = Number.MAX_SAFE_INTEGER - 1;
      g.addNode(NodeAddress.fromParts(["ninety-nine"]));
      expect(() => {
        g.addNode(NodeAddress.fromParts(["boom"]));
      }).toThrow("cannot be modified");
    });

    it("throws in case of modification count reset", () => {
      const g = new Graph();
      g.addNode(NodeAddress.fromParts(["stop"]));
      const iterator = g.nodes();
      g._modificationCount--;
      expect(() => {
        iterator.next();
      }).toThrow("modification count in the future");
    });

    describe("modification count retrieval", () => {
      it("modification count starts at 0", () => {
        const g = new Graph();
        expect(g.modificationCount()).toEqual(0);
      });
      it("modification count increases after any potential modification", () => {
        const g = new Graph();
        expect(g.modificationCount()).toEqual(0);
        g.addNode(NodeAddress.empty);
        expect(g.modificationCount()).toEqual(1);
        g.addNode(NodeAddress.empty);
        expect(g.modificationCount()).toEqual(2);
      });
      it("graphs can be equal despite unequal modification count", () => {
        const g1 = new Graph()
          .addNode(NodeAddress.empty)
          .removeNode(NodeAddress.empty);
        const g2 = new Graph();
        expect(g1.equals(g2)).toEqual(true);
        expect(g1.modificationCount()).not.toEqual(g2.modificationCount());
      });
    });

    describe("automated invariant checking", () => {
      const src = NodeAddress.fromParts(["src"]);
      const dst = NodeAddress.fromParts(["dst"]);
      const edgeAddress = EdgeAddress.fromParts(["edge"]);
      const edge = () => ({src, dst, address: edgeAddress});
      const graph = () =>
        new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge());

      describe("caches results when the graph has not been modified", () => {
        it("with passing invariants", () => {
          const g = new Graph().addNode(src);
          g.checkInvariants(); // good
          g._inEdges.delete(src); // corrupted, but only by poking at the internals
          expect(() => g.checkInvariants()).not.toThrow();
          expect(() => g._checkInvariants()).toThrow();
        });

        it("with failing invariants", () => {
          const g = new Graph().addNode(src);
          g.checkInvariants(); // good
          g._inEdges.delete(src); // corrupted
          expect(() => g.addNode(dst)).toThrow();
          g._inEdges.set(src, []); // fixed, but only by poking at the internals
          expect(() => g.checkInvariants()).toThrow();
          expect(() => g._checkInvariants()).not.toThrow();
        });
      });

      it("is happy with a conformant graph", () => {
        const g = graph();
        expect(() => g._checkInvariants()).not.toThrow();
      });

      // Invariant 1
      it("detects missing in-edges", () => {
        const g = new Graph().addNode(src);
        g._inEdges.delete(src);
        expect(() => g._checkInvariants()).toThrow("missing in-edges");
      });
      it("detects missing out-edges", () => {
        const g = new Graph().addNode(src);
        g._outEdges.delete(src);
        expect(() => g._checkInvariants()).toThrow("missing out-edges");
      });

      // Invariant 2.1
      it("detects when an edge has bad address", () => {
        const g = graph();
        const otherEdge = () => ({
          src,
          dst,
          address: EdgeAddress.fromParts(["wat"]),
        });
        g._edges.set(edgeAddress, otherEdge());
        g._inEdges.set(dst, [otherEdge()]);
        g._outEdges.set(src, [otherEdge()]);
        expect(() => g._checkInvariants()).toThrow("bad edge address");
      });
      // Invariant 2.2
      it("detects when an edge has missing src", () => {
        const g = graph();
        g._nodes.delete(src);
        g._inEdges.delete(src);
        g._outEdges.delete(src);
        expect(() => g._checkInvariants()).toThrow("missing src");
      });
      // Invariant 2.3
      it("detects when an edge has missing dst", () => {
        const g = graph();
        g._nodes.delete(dst);
        g._inEdges.delete(dst);
        g._outEdges.delete(dst);
        expect(() => g._checkInvariants()).toThrow("missing dst");
      });
      // Invariant 2.4
      it("detects when an edge is missing in `_inEdges`", () => {
        const g = graph();
        g._inEdges.set(edge().dst, []);
        expect(() => g._checkInvariants()).toThrow("missing in-edge");
      });
      // Invariant 2.5
      it("detects when an edge is missing in `_outEdges`", () => {
        const g = graph();
        g._outEdges.set(edge().src, []);
        expect(() => g._checkInvariants()).toThrow("missing out-edge");
      });

      // Invariant 3.1
      it("detects spurious in-edges", () => {
        const g = new Graph();
        g._inEdges.set(src, []);
        expect(() => g._checkInvariants()).toThrow("spurious in-edges");
      });
      // Invariant 4.1
      it("detects spurious out-edges", () => {
        const g = new Graph();
        g._outEdges.set(src, []);
        expect(() => g._checkInvariants()).toThrow("spurious out-edges");
      });

      // Invariant 3.2
      it("detects when an edge is duplicated in `_inEdges`", () => {
        const g = graph();
        g._inEdges.set(edge().dst, [edge(), edge()]);
        expect(() => g._checkInvariants()).toThrow("duplicate in-edge");
      });
      // Invariant 4.2
      it("detects when an edge is duplicated in `_outEdges`", () => {
        const g = graph();
        g._outEdges.set(edge().src, [edge(), edge()]);
        expect(() => g._checkInvariants()).toThrow("duplicate out-edge");
      });

      // Invariant 3.3 (two failure modes: absent or wrong data)
      it("detects when an edge is spurious in `_inEdges`", () => {
        const g = graph().removeEdge(edge().address);
        g._inEdges.set(edge().dst, [edge()]);
        expect(() => g._checkInvariants()).toThrow("spurious in-edge");
      });
      it("detects when an edge has bad `dst` in `_inEdges`", () => {
        const g = graph();
        g._inEdges.set(edge().dst, [{src: dst, dst, address: edgeAddress}]);
        expect(() => g._checkInvariants()).toThrow(/bad in-edge.*vs\./);
      });
      // Invariant 4.3 (two failure modes: absent or wrong data)
      it("detects when an edge is spurious in `_outEdges`", () => {
        const g = graph().removeEdge(edge().address);
        g._outEdges.set(edge().src, [edge()]);
        expect(() => g._checkInvariants()).toThrow("spurious out-edge");
      });
      it("detects when an edge has bad `src` in `_outEdges`", () => {
        const g = graph();
        g._outEdges.set(edge().src, [{src, dst: src, address: edgeAddress}]);
        expect(() => g._checkInvariants()).toThrow(/bad out-edge.*vs\./);
      });

      // Invariant 3.4
      it("detects when an edge has bad anchor in `_inEdges`", () => {
        const g = graph();
        g._inEdges.set(edge().dst, []);
        g._inEdges.set(edge().src, [edge()]);
        expect(() => g._checkInvariants()).toThrow(/bad in-edge.*anchor/);
      });
      // Invariant 4.4
      it("detects when an edge has bad anchor in `_outEdges`", () => {
        const g = graph();
        g._outEdges.set(edge().src, []);
        g._outEdges.set(edge().dst, [edge()]);
        expect(() => g._checkInvariants()).toThrow(/bad out-edge.*anchor/);
      });
    });

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
              const e = EdgeAddress.fromParts(["foo"]);
              // $ExpectFlowError
              expect(() => f.call(new Graph(), e)).toThrow("got EdgeAddress");
            });
          }
          nodeMethods.forEach(rejectsEdgeAddress);
        });
        describe("remove a node that is some edge's", () => {
          const src = NodeAddress.fromParts(["src"]);
          const dst = NodeAddress.fromParts(["dst"]);
          const address = EdgeAddress.fromParts(["edge"]);
          const edge = () => ({src, dst, address});
          const graph = () =>
            new Graph()
              .addNode(src)
              .addNode(dst)
              .addEdge(edge());
          it("src", () => {
            expect(() => graph().removeNode(src)).toThrow(
              "Attempted to remove"
            );
          });
          it("dst", () => {
            expect(() => graph().removeNode(dst)).toThrow(
              "Attempted to remove"
            );
          });
        });

        describe("concurrent modification in `nodes`", () => {
          it("while in the middle of iteration", () => {
            const g = new Graph().addNode(NodeAddress.fromParts(["node"]));
            const iterator = g.nodes();
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
          it("at exhaustion", () => {
            const g = new Graph();
            const iterator = g.nodes();
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
        });
      });

      describe("work on", () => {
        const n1 = NodeAddress.fromParts(["foo"]);
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
          const n2 = NodeAddress.fromParts([""]);
          const graph = new Graph().addNode(n1).addNode(n2);
          expect(graph.hasNode(n1)).toBe(true);
          expect(graph.hasNode(n2)).toBe(true);
          expect(Array.from(graph.nodes()).sort()).toEqual([n2, n1]);
        });
      });

      describe("node prefix filtering", () => {
        const n1 = NodeAddress.empty;
        const n2 = NodeAddress.fromParts(["foo"]);
        const n3 = NodeAddress.fromParts(["foo", "bar"]);
        const n4 = NodeAddress.fromParts(["zod", "bar"]);
        const graph = () =>
          new Graph()
            .addNode(n1)
            .addNode(n2)
            .addNode(n3)
            .addNode(n4);
        function expectSortedNodes(
          options: {|+prefix: NodeAddressT|} | void,
          expected: NodeAddressT[]
        ) {
          const actual = graph().nodes(options);
          expect(Array.from(actual).sort()).toEqual(expected.slice().sort());
        }
        it("uses empty prefix when no options object", () => {
          expectSortedNodes(undefined, [n1, n2, n3, n4]);
        });
        it("requires a prefix when options are specified", () => {
          // $ExpectFlowError
          expect(() => graph().nodes({})).toThrow("prefix");
        });
        it("does a prefix filter", () => {
          expectSortedNodes({prefix: n2}, [n2, n3]);
        });
        it("yields nothing when prefix matches nothing", () => {
          expectSortedNodes({prefix: NodeAddress.fromParts(["2"])}, []);
        });
      });

      describe("change the modification count", () => {
        it("on addNode, when a node is added", () => {
          const g = new Graph();
          const before = g._modificationCount;
          g.addNode(NodeAddress.fromParts(["hello"]));
          expect(g._modificationCount).not.toEqual(before);
        });
        it("on addNode, even when the node already exists", () => {
          const node = NodeAddress.fromParts(["hello"]);
          const g = new Graph().addNode(node);
          const before = g._modificationCount;
          g.addNode(node);
          expect(g._modificationCount).not.toEqual(before);
        });
        it("on removeNode, when a node is removed", () => {
          const node = NodeAddress.fromParts(["hello"]);
          const g = new Graph().addNode(node);
          const before = g._modificationCount;
          g.removeNode(node);
          expect(g._modificationCount).not.toEqual(before);
        });
        it("on removeNode, even when the node does not exist", () => {
          const g = new Graph();
          const before = g._modificationCount;
          g.removeNode(NodeAddress.fromParts(["hello"]));
          expect(g._modificationCount).not.toEqual(before);
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
              const e = NodeAddress.fromParts(["foo"]);
              // $ExpectFlowError
              expect(() => f.call(new Graph(), e)).toThrow("got NodeAddress");
            });
          }
          edgeAddrMethods.forEach(rejectsNodeAddress);
        });

        describe("addEdge edge validation", () => {
          describe("throws on absent", () => {
            const src = NodeAddress.fromParts(["src"]);
            const dst = NodeAddress.fromParts(["dst"]);
            const address = EdgeAddress.fromParts(["hi"]);
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

          it("throws on conflicting edge", () => {
            const src = NodeAddress.fromParts(["src"]);
            const dst = NodeAddress.fromParts(["dst"]);
            const address = EdgeAddress.fromParts(["hi"]);
            const e1 = {src, dst, address};
            const e2 = {src, dst: src, address};
            const graph = new Graph()
              .addNode(src)
              .addNode(dst)
              .addEdge(e1);
            expect(() => graph.addEdge(e2)).toThrow(
              "conflict between new edge"
            );
          });

          describe("throws on edge with", () => {
            const n = NodeAddress.fromParts(["foo"]);
            const e = EdgeAddress.fromParts(["bar"]);
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

        describe("concurrent modification in `edges`", () => {
          it("while in the middle of iteration", () => {
            const g = new Graph()
              .addNode(NodeAddress.fromParts(["node"]))
              .addEdge({
                address: EdgeAddress.fromParts(["edge"]),
                src: NodeAddress.fromParts(["node"]),
                dst: NodeAddress.fromParts(["node"]),
              });
            const iterator = g.edges();
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
          it("at exhaustion", () => {
            const g = new Graph();
            const iterator = g.edges();
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
        });
      });

      describe("edges filtering", () => {
        const src1 = NodeAddress.fromParts(["src", "1"]);
        const src2 = NodeAddress.fromParts(["src", "2"]);
        const dst1 = NodeAddress.fromParts(["dst", "1"]);
        const dst2 = NodeAddress.fromParts(["dst", "2"]);
        const e11 = {
          src: src1,
          dst: dst1,
          address: EdgeAddress.fromParts(["e", "1", "1"]),
        };
        const e12 = {
          src: src1,
          dst: dst2,
          address: EdgeAddress.fromParts(["e", "1", "2"]),
        };
        const e21 = {
          src: src2,
          dst: dst1,
          address: EdgeAddress.fromParts(["e", "2", "1"]),
        };
        const e22 = {
          src: src2,
          dst: dst2,
          address: EdgeAddress.fromParts(["e", "2", "2"]),
        };
        const graph = () =>
          [e11, e12, e21, e22].reduce(
            (g, e) => g.addEdge(e),
            [src1, src2, dst1, dst2].reduce((g, n) => g.addNode(n), new Graph())
          );
        function expectEdges(
          options: EdgesOptions | void,
          expected: $ReadOnlyArray<Edge>
        ) {
          const sort = (es) => sortBy(es, (e) => e.address);
          expect(sort(Array.from(graph().edges(options)))).toEqual(
            sort(expected.slice())
          );
        }
        it("finds all edges when no options are specified", () => {
          expectEdges(undefined, [e11, e12, e21, e22]);
        });
        it("finds all edges when universal filters are specified", () => {
          expectEdges(
            {
              addressPrefix: EdgeAddress.fromParts(["e"]),
              srcPrefix: NodeAddress.fromParts(["src"]),
              dstPrefix: NodeAddress.fromParts(["dst"]),
            },
            [e11, e12, e21, e22]
          );
        });
        it("requires `addressPrefix` to be present in provided options", () => {
          expect(() => {
            graph()
              // $ExpectFlowError
              .edges({srcPrefix: src1, dstPrefix: dst1});
          }).toThrow("Invalid address prefix: undefined");
        });
        it("requires `srcPrefix` to be present in provided options", () => {
          expect(() => {
            graph()
              // $ExpectFlowError
              .edges({addressPrefix: e11, dstPrefix: dst1});
          }).toThrow("Invalid src prefix: undefined");
        });
        it("requires `dstPrefix` to be present in provided options", () => {
          expect(() => {
            graph()
              // $ExpectFlowError
              .edges({addressPrefix: e11, srcPrefix: dst1});
          }).toThrow("Invalid dst prefix: undefined");
        });
        it("finds edges by address prefix", () => {
          expectEdges(
            {
              addressPrefix: EdgeAddress.fromParts(["e", "1"]),
              srcPrefix: NodeAddress.empty,
              dstPrefix: NodeAddress.empty,
            },
            [e11, e12]
          );
        });
        it("finds edges by src prefix", () => {
          expectEdges(
            {
              addressPrefix: EdgeAddress.empty,
              srcPrefix: NodeAddress.fromParts(["src", "1"]),
              dstPrefix: NodeAddress.empty,
            },
            [e11, e12]
          );
        });
        it("finds edges by dst prefix", () => {
          expectEdges(
            {
              addressPrefix: EdgeAddress.empty,
              srcPrefix: NodeAddress.empty,
              dstPrefix: NodeAddress.fromParts(["dst", "1"]),
            },
            [e11, e21]
          );
        });
        it("yields nothing for disjoint filters", () => {
          expectEdges(
            {
              addressPrefix: EdgeAddress.fromParts(["e", "1"]),
              srcPrefix: NodeAddress.fromParts(["src", "2"]),
              dstPrefix: NodeAddress.empty,
            },
            []
          );
        });
        it("yields appropriate filter intersection", () => {
          expectEdges(
            {
              addressPrefix: EdgeAddress.empty,
              srcPrefix: NodeAddress.fromParts(["src", "1"]),
              dstPrefix: NodeAddress.fromParts(["dst", "2"]),
            },
            [e12]
          );
        });
      });

      describe("on a graph", () => {
        const src = NodeAddress.fromParts(["foo"]);
        const dst = NodeAddress.fromParts(["bar"]);
        const address = EdgeAddress.fromParts(["yay"]);

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
          const e1 = EdgeAddress.fromParts(["e1"]);
          const e2 = EdgeAddress.fromParts(["e2"]);
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
        const src = NodeAddress.fromParts(["src"]);
        const dst = NodeAddress.fromParts(["dst"]);
        const address = EdgeAddress.fromParts(["hi"]);
        it("`addEdge`", () => {
          const g = new Graph()
            .addNode(src)
            .addNode(dst)
            .addEdge({src, dst, address})
            .addEdge({src, dst, address});
          expect(edgeArray(g)).toEqual([{src, dst, address}]);
          expect(
            Array.from(
              g.neighbors(src, {
                direction: Direction.ANY,
                nodePrefix: NodeAddress.empty,
                edgePrefix: EdgeAddress.empty,
              })
            )
          ).toHaveLength(1);
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

    describe("change the modification count", () => {
      const src = () => NodeAddress.fromParts(["fst"]);
      const dst = () => NodeAddress.fromParts(["snd"]);
      const edge = () => ({
        address: EdgeAddress.fromParts(["bridge"]),
        src: src(),
        dst: dst(),
      });
      const baseGraph = () => new Graph().addNode(src()).addNode(dst());
      it("on addEdge, when an edge is added", () => {
        const g = baseGraph();
        const before = g._modificationCount;
        g.addEdge(edge());
        expect(g._modificationCount).not.toEqual(before);
      });
      it("on addEdge, even when the edge already exists", () => {
        const g = baseGraph().addEdge(edge());
        const before = g._modificationCount;
        g.addEdge(edge());
        expect(g._modificationCount).not.toEqual(before);
      });
      it("on removeEdge, when an edge is removed", () => {
        const g = baseGraph().addEdge(edge());
        const before = g._modificationCount;
        g.removeEdge(edge().address);
        expect(g._modificationCount).not.toEqual(before);
      });
      it("on removeEdge, even when the edge does not exist", () => {
        const g = new Graph();
        const before = g._modificationCount;
        g.removeEdge(edge().address);
        expect(g._modificationCount).not.toEqual(before);
      });
    });

    describe("neighbors", () => {
      const foo = NodeAddress.fromParts(["foo", "suffix"]);
      const loop = NodeAddress.fromParts(["loop"]);
      const isolated = NodeAddress.fromParts(["isolated"]);

      const foo_loop = {
        src: foo,
        dst: loop,
        address: EdgeAddress.fromParts(["foo", "1"]),
      };
      const loop_foo = {
        src: loop,
        dst: foo,
        address: EdgeAddress.fromParts(["foo", "2"]),
      };
      const loop_loop = {
        src: loop,
        dst: loop,
        address: EdgeAddress.fromParts(["loop"]),
      };
      const repeated_loop_foo = {
        src: loop,
        dst: foo,
        address: EdgeAddress.fromParts(["repeated", "foo"]),
      };
      function quiver() {
        return new Graph()
          .addNode(foo)
          .addNode(loop)
          .addNode(isolated)
          .addEdge(foo_loop)
          .addEdge(loop_foo)
          .addEdge(loop_loop)
          .addEdge(repeated_loop_foo);
      }

      function expectNeighbors(
        node: NodeAddressT,
        options: NeighborsOptions,
        expected: Neighbor[]
      ) {
        const g = quiver();
        const actual = Array.from(g.neighbors(node, options));
        const sorter = (arr) =>
          sortBy(arr, (neighbor) => neighbor.edge.address);
        expect(sorter(actual)).toEqual(sorter(expected));
      }

      it("re-adding a node does not suppress its edges", () => {
        const graph = quiver().addNode(foo);
        expect(
          Array.from(
            graph.neighbors(foo, {
              direction: Direction.ANY,
              nodePrefix: NodeAddress.empty,
              edgePrefix: EdgeAddress.empty,
            })
          )
        ).not.toHaveLength(0);
      });

      it("isolated node has no neighbors", () => {
        expectNeighbors(
          isolated,
          {
            direction: Direction.ANY,
            nodePrefix: NodeAddress.empty,
            edgePrefix: EdgeAddress.empty,
          },
          []
        );
      });

      function expectLoopNeighbors(dir, nodeParts, edgeParts, expected) {
        const options = {
          direction: dir,
          nodePrefix: NodeAddress.fromParts(nodeParts),
          edgePrefix: EdgeAddress.fromParts(edgeParts),
        };
        expectNeighbors(loop, options, expected);
      }

      describe("direction filtering", () => {
        it("IN", () => {
          expectLoopNeighbors(
            Direction.IN,
            [],
            [],
            [{node: loop, edge: loop_loop}, {node: foo, edge: foo_loop}]
          );
        });
        it("OUT", () => {
          expectLoopNeighbors(
            Direction.OUT,
            [],
            [],
            [
              {node: loop, edge: loop_loop},
              {node: foo, edge: repeated_loop_foo},
              {node: foo, edge: loop_foo},
            ]
          );
        });
        // verifies that the loop edge is not double-counted.
        it("ANY", () => {
          expectLoopNeighbors(
            Direction.ANY,
            [],
            [],
            [
              {node: loop, edge: loop_loop},
              {node: foo, edge: repeated_loop_foo},
              {node: foo, edge: loop_foo},
              {node: foo, edge: foo_loop},
            ]
          );
        });
      });

      describe("node prefix filtering", () => {
        function nodeExpectNeighbors(parts, expected) {
          expectNeighbors(
            loop,
            {
              direction: Direction.ANY,
              nodePrefix: NodeAddress.fromParts(parts),
              edgePrefix: EdgeAddress.empty,
            },
            expected
          );
        }
        it("returns nodes exactly matching prefix", () => {
          nodeExpectNeighbors(["loop"], [{node: loop, edge: loop_loop}]);
        });
        it("returns nodes inexactly matching prefix", () => {
          nodeExpectNeighbors(
            ["foo"],
            [
              {node: foo, edge: loop_foo},
              {node: foo, edge: foo_loop},
              {node: foo, edge: repeated_loop_foo},
            ]
          );
        });
        it("returns empty for non-existent prefix", () => {
          nodeExpectNeighbors(["qux"], []);
        });
      });

      describe("edge prefix filtering", () => {
        function edgeExpectNeighbors(parts, expected) {
          expectNeighbors(
            loop,
            {
              direction: Direction.ANY,
              nodePrefix: NodeAddress.empty,
              edgePrefix: EdgeAddress.fromParts(parts),
            },
            expected
          );
        }
        it("works for an exact address match", () => {
          edgeExpectNeighbors(
            ["repeated", "foo"],
            [{node: foo, edge: repeated_loop_foo}]
          );
        });
        it("works for a proper prefix match", () => {
          edgeExpectNeighbors(
            ["foo"],
            [{node: foo, edge: foo_loop}, {node: foo, edge: loop_foo}]
          );
        });
        it("works when there are no matching edges", () => {
          edgeExpectNeighbors(["wat"], []);
        });
      });

      it("works for node and edge filter combined", () => {
        expectNeighbors(
          loop,
          {
            direction: Direction.ANY,
            nodePrefix: NodeAddress.fromParts(["foo"]),
            edgePrefix: EdgeAddress.fromParts(["repeated"]),
          },
          [{node: foo, edge: repeated_loop_foo}]
        );
      });

      describe("errors on", () => {
        const defaultOptions = () => ({
          direction: Direction.ANY,
          edgePrefix: EdgeAddress.empty,
          nodePrefix: NodeAddress.empty,
        });
        function throwsWith(node, options, message) {
          // $ExpectFlowError
          expect(() => new Graph().neighbors(node, options)).toThrow(message);
        }
        it("invalid address", () => {
          // This is a proxy for testing that NodeAddress.assertValid is called.
          // Thus we don't need to exhaustively test every bad case.
          throwsWith(EdgeAddress.empty, defaultOptions(), "NodeAddress");
        });
        it("absent node", () => {
          throwsWith(
            NodeAddress.empty,
            defaultOptions(),
            "Node does not exist"
          );
        });
        describe("concurrent modification", () => {
          it("while in the middle of iteration", () => {
            const g = quiver();
            const iterator = g.neighbors(loop, defaultOptions());
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
          it("at exhaustion", () => {
            const g = quiver();
            const iterator = g.neighbors(isolated, defaultOptions());
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
        });
      });
    });

    describe("equals", () => {
      const src = NodeAddress.fromParts(["src"]);
      const dst = NodeAddress.fromParts(["dst"]);
      const edge1 = () => ({
        src,
        dst,
        address: EdgeAddress.fromParts(["edge"]),
      });
      const conflictingEdge = () => ({
        src: dst,
        dst: src,
        address: EdgeAddress.fromParts(["edge"]),
      });
      const edge2 = () => ({
        src: dst,
        dst: src,
        address: EdgeAddress.fromParts(["edge", "2"]),
      });
      function expectEquality(g1, g2, isEqual: boolean) {
        expect(g1.equals(g2)).toBe(isEqual);
        expect(g2.equals(g1)).toBe(isEqual);
      }

      it("empty graph equals itself", () => {
        expectEquality(new Graph(), new Graph(), true);
      });
      it("empty graph doesn't equal nonempty graph", () => {
        const g = new Graph().addNode(src);
        expectEquality(g, new Graph(), false);
      });
      it("adding and removing a node doesn't change equality", () => {
        const g = new Graph().addNode(src).removeNode(src);
        expectEquality(g, new Graph(), true);
      });
      it("adding an edge changes equality", () => {
        const g1 = new Graph().addNode(src).addNode(dst);
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1());
        expectEquality(g1, g2, false);
      });
      it("adding nodes in different order doesn't change equality", () => {
        const g1 = new Graph().addNode(src).addNode(dst);
        const g2 = new Graph().addNode(dst).addNode(src);
        expectEquality(g1, g2, true);
      });
      it("graphs with conflicting edges are not equal", () => {
        const g1 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1());
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(conflictingEdge());
        expectEquality(g1, g2, false);
      });
      it("adding edges in different order doesn't change equality", () => {
        const g1 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1())
          .addEdge(edge2());
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge2())
          .addEdge(edge1());
        expectEquality(g1, g2, true);
      });
      it("adding and removing an edge doesn't change equality", () => {
        const g1 = new Graph().addNode(src).addNode(dst);
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1())
          .removeEdge(edge1().address);
        expectEquality(g1, g2, true);
      });
      it("the logically-equivalent advanced graphs are equal", () => {
        const {graph1, graph2} = advancedGraph();
        expect(graph1().equals(graph2())).toBe(true);
      });
      it("throws error on null", () => {
        // $ExpectFlowError
        expect(() => new Graph().equals(null)).toThrow("null");
      });
      it("throws error on undefined", () => {
        // $ExpectFlowError
        expect(() => new Graph().equals(undefined)).toThrow("undefined");
      });
      it("throws error on non-graph object", () => {
        // $ExpectFlowError
        expect(() => new Graph().equals({})).toThrow("object");
      });
    });
  });

  describe("copy", () => {
    it("copies can be independently mutated", () => {
      const g1 = new Graph();
      const g2 = g1.copy();
      g2.addNode(NodeAddress.fromParts(["foo"]));
      expect(g1.equals(g2)).toBe(false);
    });
    it("copies are reference-distinct", () => {
      const g = new Graph();
      expect(g).not.toBe(g.copy());
    });
    describe("copies are equal to original:", () => {
      const src = NodeAddress.fromParts(["src"]);
      const dst = NodeAddress.fromParts(["dst"]);
      const edge1 = () => ({
        src,
        dst,
        address: EdgeAddress.fromParts(["edge"]),
      });
      function expectCopyEqual(g) {
        const copy = g.copy();
        expect(copy.equals(g)).toBe(true);
      }
      it("empty graph", () => {
        expectCopyEqual(new Graph());
      });
      it("graph with node added and removed", () => {
        const g = new Graph().addNode(src).removeNode(src);
        expectCopyEqual(g);
      });
      it("graph with an edge", () => {
        const g = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1());
        expectCopyEqual(g);
      });
      it("graph with edge added and removed", () => {
        const g = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1())
          .removeEdge(edge1().address);
        expectCopyEqual(g);
      });
    });
  });

  describe("merge", () => {
    const foo = NodeAddress.fromParts(["foo"]);
    const bar = NodeAddress.fromParts(["bar"]);
    const zod = NodeAddress.fromParts(["zod"]);
    const foofoo = () => ({
      src: foo,
      dst: foo,
      address: EdgeAddress.fromParts(["foofoo"]),
    });
    const foobar = () => ({
      src: foo,
      dst: bar,
      address: EdgeAddress.fromParts(["foobar"]),
    });
    const zodfoo = () => ({
      src: zod,
      dst: foo,
      address: EdgeAddress.fromParts(["zodfoo"]),
    });
    const conflictingZodfoo = () => ({
      src: zod,
      dst: zod,
      address: EdgeAddress.fromParts(["zodfoo"]),
    });
    it("yields empty graph on empty input", () => {
      expect(Graph.merge([]).equals(new Graph())).toBe(true);
    });
    it("can be independently mutated from input", () => {
      const g1 = new Graph();
      const g2 = Graph.merge([g1]);
      expect(g1.equals(g2)).toBe(true);
      g2.addNode(foo);
      expect(g1.equals(g2)).toBe(false);
    });
    it("is identity on a singleton input", () => {
      const graph = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addEdge(foobar());
      expect(graph.equals(Graph.merge([graph]))).toBe(true);
    });
    it("merges two graphs with no intersection", () => {
      const g1 = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addEdge(foobar());
      const g2 = new Graph().addNode(zod);
      const g3_actual = Graph.merge([g1, g2]);
      const g3_expected = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addNode(zod)
        .addEdge(foobar());
      expect(g3_actual.equals(g3_expected)).toBe(true);
    });
    it("merges two graphs with nontrivial intersection", () => {
      const g1 = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addEdge(foobar())
        .addEdge(foofoo());
      const g2 = new Graph()
        .addNode(foo)
        .addNode(zod)
        .addEdge(zodfoo())
        .addEdge(foofoo());
      const g3_actual = Graph.merge([g1, g2]);
      const g3_expected = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addNode(zod)
        .addEdge(foobar())
        .addEdge(zodfoo())
        .addEdge(foofoo());
      expect(g3_actual.equals(g3_expected)).toBe(true);
    });
    it("merges many graphs", () => {
      const graphs = [];
      const expected = new Graph();
      for (let i = 0; i < 10; i++) {
        const node = NodeAddress.fromParts([String(i)]);
        expected.addNode(node);
        graphs.push(new Graph().addNode(node));
      }
      const actual = Graph.merge(graphs);
      expect(actual.equals(expected)).toBe(true);
    });
    it("merges the advanced graphs together", () => {
      const {graph1, graph2} = advancedGraph();
      const graph3 = Graph.merge([graph1(), graph2()]);
      expect(graph1().equals(graph3)).toBe(true);
      expect(graph2().equals(graph3)).toBe(true);
    });
    it("rejects graphs with conflicting edges", () => {
      const g1 = new Graph()
        .addNode(foo)
        .addNode(zod)
        .addEdge(zodfoo());
      const g2 = new Graph()
        .addNode(foo)
        .addNode(zod)
        .addEdge(conflictingZodfoo());
      expect(() => Graph.merge([g1, g2])).toThrow("conflict between new edge");
    });
  });

  describe("toJSON / fromJSON", () => {
    const src = NodeAddress.fromParts(["src"]);
    const dst = NodeAddress.fromParts(["dst"]);
    const edge1 = () => ({
      src,
      dst,
      address: EdgeAddress.fromParts(["edge"]),
    });
    const edge2 = () => ({
      src: dst,
      dst: src,
      address: EdgeAddress.fromParts(["edge", "2"]),
    });
    describe("snapshot testing", () => {
      it("a trivial graph", () => {
        const graph = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1())
          .addEdge(edge2());
        expect(graph.toJSON()).toMatchSnapshot();
      });
      it("an advanced graph", () => {
        const graph = advancedGraph().graph1();
        expect(graph.toJSON()).toMatchSnapshot();
      });
    });

    describe("compose to identity", () => {
      function expectCompose(g) {
        const json = g.toJSON();
        const newGraph = Graph.fromJSON(json);
        const newJSON = newGraph.toJSON();
        expect(newGraph.equals(g)).toBe(true);
        expect(newJSON).toEqual(json);
      }
      it("for an empty graph", () => {
        expectCompose(new Graph());
      });
      it("for a graph with some nodes", () => {
        const g = new Graph().addNode(src).addNode(dst);
        expectCompose(g);
      });
      it("for a graph with nodes added and removed", () => {
        const g = new Graph()
          .addNode(src)
          .addNode(dst)
          .removeNode(src);
        expectCompose(g);
      });
      it("for a graph with nodes and edges", () => {
        const g = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1())
          .addEdge(edge2());
        expectCompose(g);
      });
      it("for the advanced graph", () => {
        const g = advancedGraph().graph1();
        expectCompose(g);
      });
    });

    describe("toJSON representation is canonical", () => {
      function expectCanonicity(g1, g2) {
        expect(g1.toJSON()).toEqual(g2.toJSON());
      }
      it("for an empty graph", () => {
        expectCanonicity(new Graph(), new Graph());
      });
      it("for graph with nodes added in different order", () => {
        const g1 = new Graph().addNode(src).addNode(dst);
        const g2 = new Graph().addNode(dst).addNode(src);
        expectCanonicity(g1, g2);
      });
      it("for a graph with nodes added and removed", () => {
        const g1 = new Graph()
          .addNode(src)
          .addNode(dst)
          .removeNode(src);
        const g2 = new Graph().addNode(dst);
        expectCanonicity(g1, g2);
      });
      it("for a graph with edges added and removed", () => {
        const g1 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge1())
          .removeEdge(edge1().address)
          .addEdge(edge2());
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(edge2());
        expectCanonicity(g1, g2);
      });
      it("for the advanced graph", () => {
        const {graph1, graph2} = advancedGraph();
        expectCanonicity(graph1(), graph2());
      });
    });
  });

  describe("edgeToString", () => {
    it("works", () => {
      const edge = {
        address: EdgeAddress.fromParts(["one", "two"]),
        dst: NodeAddress.fromParts(["five", "six"]),
        src: NodeAddress.fromParts(["three", "four"]),
      };
      const expected =
        "{" +
        'address: EdgeAddress["one","two"], ' +
        'src: NodeAddress["three","four"], ' +
        'dst: NodeAddress["five","six"]' +
        "}";
      expect(edgeToString(edge)).toEqual(expected);
    });
  });

  describe("edgeToStrings", () => {
    it("works", () => {
      const edge = {
        address: EdgeAddress.fromParts(["one", "two"]),
        dst: NodeAddress.fromParts(["five", "six"]),
        src: NodeAddress.fromParts(["three", "four"]),
      };
      const expected = {
        address: 'EdgeAddress["one","two"]',
        src: 'NodeAddress["three","four"]',
        dst: 'NodeAddress["five","six"]',
      };
      expect(edgeToStrings(edge)).toEqual(expected);
    });
  });

  describe("edgeToParts", () => {
    it("works", () => {
      const edge = {
        address: EdgeAddress.fromParts(["one", "two"]),
        dst: NodeAddress.fromParts(["five", "six"]),
        src: NodeAddress.fromParts(["three", "four"]),
      };
      const expected = {
        addressParts: ["one", "two"],
        srcParts: ["three", "four"],
        dstParts: ["five", "six"],
      };
      expect(edgeToParts(edge)).toEqual(expected);
    });
  });

  it("sortedEdgeAddressesFromJSON", () => {
    const json = advancedGraph()
      .graph1()
      .toJSON();
    const sortedEdgeAddresses = sortedEdgeAddressesFromJSON(json);
    const expected = sortedEdgeAddresses.slice().sort();
    expect(sortedEdgeAddresses).toEqual(expected);
  });
  it("sortedNodeAddressesFromJSON", () => {
    const json = advancedGraph()
      .graph1()
      .toJSON();
    const sortedNodeAddresses = sortedNodeAddressesFromJSON(json);
    const expected = sortedNodeAddresses.slice().sort();
    expect(sortedNodeAddresses).toEqual(expected);
  });
});
