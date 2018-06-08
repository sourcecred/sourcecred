// @flow

import sortBy from "lodash.sortby";

import {
  type EdgeAddressT,
  type Neighbor,
  type NeighborsOptions,
  type NodeAddressT,
  Direction,
  EdgeAddress,
  Graph,
  NodeAddress,
  edgeToString,
} from "./graph";

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
                nodePrefix: NodeAddress.fromParts([]),
                edgePrefix: EdgeAddress.fromParts([]),
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
              nodePrefix: NodeAddress.fromParts([]),
              edgePrefix: EdgeAddress.fromParts([]),
            })
          )
        ).not.toHaveLength(0);
      });

      it("isolated node has no neighbors", () => {
        expectNeighbors(
          isolated,
          {
            direction: Direction.ANY,
            nodePrefix: NodeAddress.fromParts([]),
            edgePrefix: EdgeAddress.fromParts([]),
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
              edgePrefix: EdgeAddress.fromParts([]),
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
              nodePrefix: NodeAddress.fromParts([]),
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
          edgePrefix: EdgeAddress.fromParts([]),
          nodePrefix: NodeAddress.fromParts([]),
        });
        function throwsWith(node, options, message) {
          // $ExpectFlowError
          expect(() => new Graph().neighbors(node, options)).toThrow(message);
        }
        it("invalid address", () => {
          // This is a proxy for testing that NodeAddress.assertValid is called.
          // Thus we don't need to exhaustively test every bad case.
          throwsWith(
            EdgeAddress.fromParts([]),
            defaultOptions(),
            "NodeAddress"
          );
        });
        it("absent node", () => {
          throwsWith(
            NodeAddress.fromParts([]),
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
});
