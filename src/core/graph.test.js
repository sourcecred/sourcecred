// @flow

import sortBy from "lodash.sortby";

import {
  type Node,
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
  nodeToString,
  edgeToString,
  edgeToStrings,
  edgeToParts,
  sortedEdgeAddressesFromJSON,
  sortedNodeAddressesFromJSON,
} from "./graph";
import {advancedGraph, node, partsNode, edge, partsEdge} from "./graphTestUtil";

describe("core/graph", () => {
  function _unused_itExportsDistinctNodeAddressAndEdgeAddressTypes() {
    // $ExpectFlowError
    const _unused_nodeToEdge = (x: NodeAddressT): EdgeAddressT => x;
    // $ExpectFlowError
    const _unused_edgeToNode = (x: EdgeAddressT): NodeAddressT => x;
  }

  const src = node("src");
  const dst = node("dst");
  const simpleEdge = edge("edge", src, dst);
  const differentAddressEdge = edge("wat", src, dst);
  const loopEdge = edge("loop", src, src);

  const simpleGraph = () =>
    new Graph()
      .addNode(src)
      .addNode(dst)
      .addEdge(simpleEdge);

  function sortNodes(nodes: Node[]): Node[] {
    return sortBy(nodes, (x) => x.address);
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
      g.addNode(node("one"));
      g.addNode(node("two"));
      // skip a few
      g._modificationCount = Number.MAX_SAFE_INTEGER - 1;
      g.addNode(node("ninety-nine"));
      expect(() => {
        g.addNode(node("ninety-nine"));
      }).toThrow("cannot be modified");
    });

    it("throws in case of modification count reset", () => {
      const g = new Graph();
      g.addNode(node("stop"));
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
        g.addNode(node("one"));
        expect(g.modificationCount()).toEqual(1);
        g.addNode(node("one"));
        expect(g.modificationCount()).toEqual(2);
      });
      it("graphs can be equal despite unequal modification count", () => {
        const g1 = new Graph()
          .addNode(node("one"))
          .removeNode(node("one").address);
        const g2 = new Graph();
        expect(g1.equals(g2)).toEqual(true);
        expect(g1.modificationCount()).not.toEqual(g2.modificationCount());
      });
    });

    describe("automated invariant checking", () => {
      describe("caches results when the graph has not been modified", () => {
        it("with passing invariants", () => {
          const g = new Graph().addNode(src);
          g.checkInvariants(); // good
          g._incidentEdges.delete(src.address); // corrupted, but only by poking at the internals
          expect(() => g.checkInvariants()).not.toThrow();
          expect(() => g._checkInvariants()).toThrow();
        });

        it("with failing invariants", () => {
          const g = new Graph().addNode(src);
          g.checkInvariants(); // good
          g._incidentEdges.delete(src.address); // corrupted
          expect(() => g.addNode(dst)).toThrow();
          g._incidentEdges.set(src.address, {inEdges: [], outEdges: []}); // fixed, but only by poking at the internals
          expect(() => g.checkInvariants()).toThrow();
          expect(() => g._checkInvariants()).not.toThrow();
        });
      });

      it("is happy with a conformant graph", () => {
        const g = simpleGraph();
        expect(() => g._checkInvariants()).not.toThrow();
      });

      // Invariant 1.1
      it("detects a node filed under incorrect address", () => {
        const g = new Graph().addNode(src);
        g._nodes.delete(src.address);
        g._nodes.set(dst.address, src);
        expect(() => g._checkInvariants()).toThrow("bad node address");
      });
      // Invariant 1.2
      it("detects missing incident edges", () => {
        const g = new Graph().addNode(src);
        g._incidentEdges.delete(src.address);
        expect(() => g._checkInvariants()).toThrow("missing incident-edges");
      });

      // Invariant 2.1
      it("detects when an edge has bad address", () => {
        const g = simpleGraph();
        g._edges.set(simpleEdge.address, differentAddressEdge);
        // $ExpectFlowError
        g._incidentEdges.get(dst.address).inEdges = [differentAddressEdge];
        // $ExpectFlowError
        g._incidentEdges.get(src.address).outEdges = [differentAddressEdge];
        expect(() => g._checkInvariants()).toThrow("bad edge address");
      });
      // Invariant 2.2
      it("detects when an edge has missing src", () => {
        const g = simpleGraph();
        g._nodes.delete(src.address);
        g._incidentEdges.delete(src.address);
        expect(() => g._checkInvariants()).toThrow("missing src");
      });
      // Invariant 2.3
      it("detects when an edge has missing dst", () => {
        const g = simpleGraph();
        g._nodes.delete(dst.address);
        g._incidentEdges.delete(dst.address);
        expect(() => g._checkInvariants()).toThrow("missing dst");
      });
      // Invariant 2.4
      it("detects when an edge is missing in `_inEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.dst).inEdges = [];
        expect(() => g._checkInvariants()).toThrow("missing in-edge");
      });
      // Invariant 2.5
      it("detects when an edge is missing in `_outEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.src).outEdges = [];
        expect(() => g._checkInvariants()).toThrow("missing out-edge");
      });

      // Temporary invariant
      it("detects spurious incident-edges", () => {
        const g = new Graph();
        g._incidentEdges.set(src.address, {inEdges: [], outEdges: []});
        expect(() => g._checkInvariants()).toThrow("spurious incident-edges");
      });

      // Invariant 3.1
      it("detects when an edge is duplicated in `_inEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.dst).inEdges = [simpleEdge, simpleEdge];
        expect(() => g._checkInvariants()).toThrow("duplicate in-edge");
      });
      // Invariant 4.1
      it("detects when an edge is duplicated in `_outEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.src).outEdges = [
          simpleEdge,
          simpleEdge,
        ];
        expect(() => g._checkInvariants()).toThrow("duplicate out-edge");
      });

      // Invariant 3.2 (two failure modes: absent or wrong data)
      it("detects when an edge is spurious in `_inEdges`", () => {
        const g = simpleGraph().removeEdge(simpleEdge.address);
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.dst).inEdges = [simpleEdge];
        expect(() => g._checkInvariants()).toThrow("spurious in-edge");
      });
      it("detects when an edge has bad `dst` in `_inEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.dst).inEdges = [
          {src: dst.address, dst: dst.address, address: simpleEdge.address},
        ];
        expect(() => g._checkInvariants()).toThrow(/bad in-edge.*vs\./);
      });
      // Invariant 4.2 (two failure modes: absent or wrong data)
      it("detects when an edge is spurious in `_outEdges`", () => {
        const g = simpleGraph().removeEdge(simpleEdge.address);
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.src).outEdges = [simpleEdge];
        expect(() => g._checkInvariants()).toThrow("spurious out-edge");
      });
      it("detects when an edge has bad `src` in `_outEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.src).outEdges = [
          {src: src.address, dst: src.address, address: simpleEdge.address},
        ];
        expect(() => g._checkInvariants()).toThrow(/bad out-edge.*vs\./);
      });

      // Invariant 3.3
      it("detects when an edge has bad anchor in `_inEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.dst).inEdges = [];
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.src).inEdges = [simpleEdge];
        expect(() => g._checkInvariants()).toThrow(/bad in-edge.*anchor/);
      });
      // Invariant 4.3
      it("detects when an edge has bad anchor in `_outEdges`", () => {
        const g = simpleGraph();
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.src).outEdges = [];
        // $ExpectFlowError
        g._incidentEdges.get(simpleEdge.dst).outEdges = [simpleEdge];
        expect(() => g._checkInvariants()).toThrow(/bad out-edge.*anchor/);
      });
    });

    describe("node methods", () => {
      describe("error on", () => {
        const p = Graph.prototype;
        const nodeMethods = [p.node, p.removeNode, p.hasNode];
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
          it("addNode rejects EdgeAddress", () => {
            const n = {
              ...node("foo"),
              address: EdgeAddress.fromParts(["foo"]),
            };
            // $ExpectFlowError
            expect(() => new Graph().addNode(n).toThrow("got EdgeAddress"));
          });
        });
        describe("remove a node that is some edge's", () => {
          it("src", () => {
            expect(() => simpleGraph().removeNode(src.address)).toThrow(
              "Attempted to remove"
            );
          });
          it("dst", () => {
            expect(() => simpleGraph().removeNode(dst.address)).toThrow(
              "Attempted to remove"
            );
          });
        });

        it("distinct nodes with the same address", () => {
          const g = new Graph();
          const n1 = node("foo");
          const n2 = {...n1, boink: "zod"};
          // $ExpectFlowError
          expect(() => g.addNode(n1).addNode(n2)).toThrow(
            "conflict between new node"
          );
        });

        describe("concurrent modification in `nodes`", () => {
          it("while in the middle of iteration", () => {
            const g = new Graph().addNode(node("node"));
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
        it("a graph with no nodes", () => {
          const graph = new Graph();
          expect(graph.hasNode(src.address)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
        });
        it("a graph with a node added", () => {
          const graph = new Graph().addNode(src);
          expect(graph.hasNode(src.address)).toBe(true);
          expect(Array.from(graph.nodes())).toEqual([src]);
          expect(graph.node(src.address)).toEqual(src);
        });
        it("a graph with the same node added twice", () => {
          const graph = new Graph().addNode(src).addNode(src);
          expect(graph.hasNode(src.address)).toBe(true);
          expect(Array.from(graph.nodes())).toEqual([src]);
          expect(graph.node(src.address)).toEqual(src);
        });
        it("a graph with an absent node removed", () => {
          const graph = new Graph().removeNode(src.address);
          expect(graph.hasNode(src.address)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
          expect(graph.node(src.address)).toEqual(undefined);
        });
        it("a graph with an added node removed", () => {
          const graph = new Graph().addNode(src).removeNode(src.address);
          expect(graph.hasNode(src.address)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
          expect(graph.node(src.address)).toEqual(undefined);
        });
        it("a graph with an added node removed twice", () => {
          const graph = new Graph()
            .addNode(src)
            .removeNode(src.address)
            .removeNode(src.address);
          expect(graph.hasNode(src.address)).toBe(false);
          expect(Array.from(graph.nodes())).toHaveLength(0);
          expect(graph.node(src.address)).toEqual(undefined);
        });
        it("a graph with two nodes", () => {
          const graph = new Graph().addNode(src).addNode(dst);
          expect(graph.hasNode(src.address)).toBe(true);
          expect(graph.hasNode(dst.address)).toBe(true);
          expect(Array.from(graph.nodes())).toEqual([src, dst]);
          expect(graph.node(src.address)).toEqual(src);
          expect(graph.node(dst.address)).toEqual(dst);
        });
      });

      describe("node prefix filtering", () => {
        const n1 = partsNode([]);
        const n2 = partsNode(["foo"]);
        const n3 = partsNode(["foo", "bar"]);
        const n4 = partsNode(["zod", "bar"]);
        const prefixGraph = () =>
          new Graph()
            .addNode(n1)
            .addNode(n2)
            .addNode(n3)
            .addNode(n4);
        function expectEqualNodes(
          options: {|+prefix: NodeAddressT|} | void,
          expected: Node[]
        ) {
          const actual = sortNodes(Array.from(prefixGraph().nodes(options)));
          expect(actual).toEqual(sortNodes(expected));
        }
        it("uses empty prefix when no options object", () => {
          expectEqualNodes(undefined, [n1, n2, n3, n4]);
        });
        it("requires a prefix when options are specified", () => {
          // $ExpectFlowError
          expect(() => simpleGraph().nodes({})).toThrow("prefix");
        });
        it("does a prefix filter", () => {
          expectEqualNodes({prefix: n2.address}, [n2, n3]);
        });
        it("empty prefix matches all nodes", () => {
          expectEqualNodes({prefix: NodeAddress.empty}, [n1, n2, n3, n4]);
        });
        it("yields nothing when prefix matches nothing", () => {
          expectEqualNodes({prefix: NodeAddress.fromParts(["2"])}, []);
        });
      });

      describe("change the modification count", () => {
        it("on addNode, when a node is added", () => {
          const g = new Graph();
          const before = g._modificationCount;
          g.addNode(src);
          expect(g._modificationCount).not.toEqual(before);
        });
        it("on addNode, even when the node already exists", () => {
          const g = new Graph().addNode(src);
          const before = g._modificationCount;
          g.addNode(src);
          expect(g._modificationCount).not.toEqual(before);
        });
        it("on removeNode, when a node is removed", () => {
          const g = new Graph().addNode(src);
          const before = g._modificationCount;
          g.removeNode(src.address);
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
            it("src", () => {
              expect(() =>
                new Graph().addNode(dst).addEdge(simpleEdge)
              ).toThrow("Missing src");
            });
            it("dst", () => {
              expect(() =>
                new Graph().addNode(src).addEdge(simpleEdge)
              ).toThrow("Missing dst");
            });
          });

          it("throws on conflicting edge", () => {
            const e1 = edge("1", src, dst);
            const e2 = edge("1", src, src);
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
                const graph = new Graph().addNode(node("foo"));
                // $ExpectFlowError
                expect(() => graph.addEdge(edge)).toThrow(msg);
              });
            });
          });
        });

        describe("concurrent modification in `edges`", () => {
          it("while in the middle of iteration", () => {
            const g = simpleGraph();
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
        const src1 = partsNode(["src", "1"]);
        const src2 = partsNode(["src", "2"]);
        const dst1 = partsNode(["dst", "1"]);
        const dst2 = partsNode(["dst", "2"]);
        const e11 = partsEdge(["e", "1", "1"], src1, dst1);
        const e12 = partsEdge(["e", "1", "2"], src1, dst2);
        const e21 = partsEdge(["e", "2", "1"], src2, dst1);
        const e22 = partsEdge(["e", "2", "2"], src2, dst2);
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
        describe("that has no edges or nodes", () => {
          it("`hasEdge` is false for some address", () => {
            expect(new Graph().hasEdge(simpleEdge.address)).toBe(false);
          });
          it("`edge` is undefined for some address", () => {
            expect(new Graph().edge(simpleEdge.address)).toBe(undefined);
          });
          it("`edges` is empty", () => {
            expect(edgeArray(new Graph())).toHaveLength(0);
          });
        });

        describe("with just one edge", () => {
          it("`hasEdge` can discover the edge", () => {
            expect(simpleGraph().hasEdge(simpleEdge.address)).toBe(true);
          });
          it("`edge` can retrieve the edge", () => {
            expect(simpleGraph().edge(simpleEdge.address)).toEqual(simpleEdge);
          });
          it("`edges` contains the edge", () => {
            const edgeArray = (g: Graph) => Array.from(g.edges());
            expect(edgeArray(simpleGraph())).toEqual([simpleEdge]);
          });
        });

        describe("with edge added and removed", () => {
          const removedGraph = () =>
            simpleGraph().removeEdge(simpleEdge.address);
          it("`hasEdge` now returns false", () => {
            expect(removedGraph().hasEdge(simpleEdge.address)).toBe(false);
          });
          it("`edge` returns undefined", () => {
            expect(removedGraph().edge(simpleEdge.address)).toBe(undefined);
          });
          it("`edges` is empty", () => {
            expect(edgeArray(removedGraph())).toHaveLength(0);
          });
          it("nodes were not removed", () => {
            expect(removedGraph().hasNode(src.address)).toBe(true);
            expect(removedGraph().hasNode(dst.address)).toBe(true);
            expect(Array.from(removedGraph().nodes())).toHaveLength(2);
          });
        });

        describe("with multiple loop edges", () => {
          const e1 = edge("e1", src, src);
          const e2 = edge("e2", src, src);
          const quiver = () =>
            new Graph()
              .addNode(src)
              .addEdge(e1)
              .addEdge(e2);
          it("adding multiple loop edges throws no error", () => {
            quiver();
          });
          it("both edges are discoverable via `hasEdge`", () => {
            expect(quiver().hasEdge(e1.address)).toBe(true);
            expect(quiver().hasEdge(e2.address)).toBe(true);
          });
          it("both edges are retrievable via `edge`", () => {
            expect(quiver().edge(e1.address)).toEqual(e1);
            expect(quiver().edge(e2.address)).toEqual(e2);
          });
          it("both edges are retrievable from `edges`", () => {
            expect(edgeArray(quiver()).sort()).toEqual([e1, e2].sort());
          });
        });
      });

      describe("idempotency of", () => {
        it("`addEdge`", () => {
          const g = simpleGraph().addEdge(simpleEdge);
          expect(edgeArray(g)).toEqual([simpleEdge]);
          expect(
            Array.from(
              g.neighbors(src.address, {
                direction: Direction.ANY,
                nodePrefix: NodeAddress.empty,
                edgePrefix: EdgeAddress.empty,
              })
            )
          ).toHaveLength(1);
        });
        it("`removeEdge`", () => {
          const g = simpleGraph()
            .removeEdge(simpleEdge.address)
            .removeEdge(simpleEdge.address);
          expect(edgeArray(g)).toHaveLength(0);
        });
      });
    });

    describe("change the modification count", () => {
      const baseGraph = () => new Graph().addNode(src).addNode(dst);
      it("on addEdge, when an edge is added", () => {
        const g = baseGraph();
        const before = g._modificationCount;
        g.addEdge(simpleEdge);
        expect(g._modificationCount).not.toEqual(before);
      });
      it("on addEdge, even when the edge already exists", () => {
        const g = baseGraph().addEdge(simpleEdge);
        const before = g._modificationCount;
        g.addEdge(simpleEdge);
        expect(g._modificationCount).not.toEqual(before);
      });
      it("on removeEdge, when an edge is removed", () => {
        const g = baseGraph().addEdge(simpleEdge);
        const before = g._modificationCount;
        g.removeEdge(simpleEdge.address);
        expect(g._modificationCount).not.toEqual(before);
      });
      it("on removeEdge, even when the edge does not exist", () => {
        const g = new Graph();
        const before = g._modificationCount;
        g.removeEdge(simpleEdge.address);
        expect(g._modificationCount).not.toEqual(before);
      });
    });

    describe("neighbors", () => {
      const foo = partsNode(["foo", "suffix"]);
      const loop = partsNode(["loop"]);
      const isolated = partsNode(["isolated"]);

      const foo_loop = partsEdge(["foo", "1"], foo, loop);
      const loop_foo = partsEdge(["foo", "2"], loop, foo);
      const loop_loop = partsEdge(["loop"], loop, loop);
      const repeated_loop_foo = partsEdge(["repeated", "foo"], loop, foo);
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
            graph.neighbors(foo.address, {
              direction: Direction.ANY,
              nodePrefix: NodeAddress.empty,
              edgePrefix: EdgeAddress.empty,
            })
          )
        ).not.toHaveLength(0);
      });

      it("isolated node has no neighbors", () => {
        expectNeighbors(
          isolated.address,
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
        expectNeighbors(loop.address, options, expected);
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
            loop.address,
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
            loop.address,
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
          loop.address,
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
            const iterator = g.neighbors(loop.address, defaultOptions());
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
          it("at exhaustion", () => {
            const g = quiver();
            const iterator = g.neighbors(isolated.address, defaultOptions());
            g._modificationCount++;
            expect(() => iterator.next()).toThrow("Concurrent modification");
          });
        });
      });
    });

    describe("equals", () => {
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
        const g = new Graph().addNode(src).removeNode(src.address);
        expectEquality(g, new Graph(), true);
      });
      it("adding an edge changes equality", () => {
        const g1 = new Graph().addNode(src).addNode(dst);
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge);
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
          .addEdge(simpleEdge);
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(differentAddressEdge);
        expectEquality(g1, g2, false);
      });
      it("adding edges in different order doesn't change equality", () => {
        const g1 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge)
          .addEdge(loopEdge);
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(loopEdge)
          .addEdge(simpleEdge);
        expectEquality(g1, g2, true);
      });
      it("adding and removing an edge doesn't change equality", () => {
        const g1 = new Graph().addNode(src).addNode(dst);
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge)
          .removeEdge(simpleEdge.address);
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
      g2.addNode(src);
      expect(g1.equals(g2)).toBe(false);
    });
    it("copies are reference-distinct", () => {
      const g = new Graph();
      expect(g).not.toBe(g.copy());
    });
    describe("copies are equal to original:", () => {
      function expectCopyEqual(g) {
        const copy = g.copy();
        expect(copy.equals(g)).toBe(true);
      }
      it("empty graph", () => {
        expectCopyEqual(new Graph());
      });
      it("graph with node added and removed", () => {
        const g = new Graph().addNode(src).removeNode(src.address);
        expectCopyEqual(g);
      });
      it("graph with an edge", () => {
        const g = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge);
        expectCopyEqual(g);
      });
      it("graph with edge added and removed", () => {
        const g = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge)
          .removeEdge(simpleEdge.address);
        expectCopyEqual(g);
      });
    });
  });

  describe("merge", () => {
    const foo = node("foo");
    const bar = node("bar");
    const zod = node("zod");
    const foofoo = edge("foofoo", foo, foo);
    const foobar = edge("foobar", foo, bar);
    const zodfoo = edge("zodfoo", zod, foo);
    const conflictingZodfoo = edge("zodfoo", zod, zod);
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
        .addEdge(foobar);
      expect(graph.equals(Graph.merge([graph]))).toBe(true);
    });
    it("merges two graphs with no intersection", () => {
      const g1 = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addEdge(foobar);
      const g2 = new Graph().addNode(zod);
      const g3_actual = Graph.merge([g1, g2]);
      const g3_expected = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addNode(zod)
        .addEdge(foobar);
      expect(g3_actual.equals(g3_expected)).toBe(true);
    });
    it("merges two graphs with nontrivial intersection", () => {
      const g1 = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addEdge(foobar)
        .addEdge(foofoo);
      const g2 = new Graph()
        .addNode(foo)
        .addNode(zod)
        .addEdge(zodfoo)
        .addEdge(foofoo);
      const g3_actual = Graph.merge([g1, g2]);
      const g3_expected = new Graph()
        .addNode(foo)
        .addNode(bar)
        .addNode(zod)
        .addEdge(foobar)
        .addEdge(zodfoo)
        .addEdge(foofoo);
      expect(g3_actual.equals(g3_expected)).toBe(true);
    });
    it("merges many graphs", () => {
      const graphs = [];
      const expected = new Graph();
      for (let i = 0; i < 10; i++) {
        const n = node(String(i));
        expected.addNode(n);
        graphs.push(new Graph().addNode(n));
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
        .addEdge(zodfoo);
      const g2 = new Graph()
        .addNode(foo)
        .addNode(zod)
        .addEdge(conflictingZodfoo);
      expect(() => Graph.merge([g1, g2])).toThrow("conflict between new edge");
    });
  });

  describe("toJSON / fromJSON", () => {
    describe("snapshot testing", () => {
      it("a trivial graph", () => {
        const graph = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge)
          .addEdge(differentAddressEdge);
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
          .removeNode(src.address);
        expectCompose(g);
      });
      it("for a graph with nodes and edges", () => {
        const g = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge)
          .addEdge(loopEdge);
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
          .removeNode(src.address);
        const g2 = new Graph().addNode(dst);
        expectCanonicity(g1, g2);
      });
      it("for a graph with edges added and removed", () => {
        const g1 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(simpleEdge)
          .removeEdge(simpleEdge.address)
          .addEdge(loopEdge);
        const g2 = new Graph()
          .addNode(src)
          .addNode(dst)
          .addEdge(loopEdge);
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

  describe("nodeToString", () => {
    it("works", () => {
      const string = nodeToString(node("foo"));
      expect(string).toMatchInlineSnapshot(
        `"{address: NodeAddress[\\"foo\\"]}"`
      );
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
