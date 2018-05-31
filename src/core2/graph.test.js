// @flow
import stringify from "json-stable-stringify";
import sortBy from "lodash.sortby";

import type {Node, Edge, NodeReference} from "./graph";
import {DelegateNodeReference, Graph} from "./graph";

import {
  FooPayload,
  FooReference,
  BarPayload,
  Handler,
  EXAMPLE_PLUGIN_NAME,
} from "./examplePlugin";

describe("graph", () => {
  function expectNodesSameSorted(
    actual: Iterable<?Node<any, any>>,
    expected: Iterable<?Node<any, any>>
  ) {
    const sort = (xs) =>
      sortBy(Array.from(xs), (x) => (x == null ? "" : stringify(x.address)));
    expect(sort(actual)).toEqual(sort(expected));
  }

  const newGraph = () => new Graph([new Handler()]);

  describe("plugin handlers", () => {
    it("Graph stores plugins", () => {
      const plugins = [new Handler()];
      const graph = new Graph(plugins);
      expect(graph.plugins()).toEqual(plugins);
    });
    it("Graph stored a slice of the plugins", () => {
      const plugins = [];
      const graph = new Graph(plugins);
      plugins.push(new Handler());
      expect(graph.plugins()).toHaveLength(0);
    });
    it("Graph returns a slice of the plugins", () => {
      const graph = new Graph([]);
      const plugins = graph.plugins();
      (plugins: any).push(new Handler());
      expect(graph.plugins()).toHaveLength(0);
    });
  });

  describe("ref", () => {
    const ref = () => newGraph().ref(new FooPayload().address());
    it(".address", () => {
      expect(ref().address()).toEqual(new FooPayload().address());
    });
    it(".graph", () => {
      expect(ref().graph()).toEqual(newGraph());
    });
    it(".get returns undefined when node not present", () => {
      expect(ref().get()).toEqual(undefined);
    });
    it(".get returns node if node later added", () => {
      const g = newGraph();
      const address = new FooPayload().address();
      const r = g.ref(address);
      g.addNode(new FooPayload());
      expect(r.get()).toEqual(g.node(address));
    });
    it("instantiates specific class using plugin handler", () => {
      expect(ref()).toBeInstanceOf(FooReference);
    });
    it("errors for null or undefined address", () => {
      const graph = newGraph();
      expect(() => graph.ref((null: any))).toThrow("null");
      expect(() => graph.ref((undefined: any))).toThrow("undefined");
    });
    describe("neighbors", () => {
      // Note: The tests share more state within this block than in the rest of the code.
      // It should be fine so long as neighbors never mutates the graph.
      const edge = (id, src, dst, type = "EDGE") => ({
        address: {id, owner: {plugin: EXAMPLE_PLUGIN_NAME, type}},
        src: src.address(),
        dst: dst.address(),
        payload: {},
      });
      // A cute little diagram:
      // A>B = edge from A to B
      // Nodes in the graph: bar, foo, isolated
      // (Parens) = Repeated or absent node
      //
      //    bar
      //     V
      //    foo  > (foo)
      //     V
      //   (absent)   isolated
      const foo = new FooPayload();
      const bar = new BarPayload(1, "hello");
      const isolated = new BarPayload(666, "ghost");
      const absent = new BarPayload(404, "hello");

      const bar_foo = edge("bar_foo", bar, foo);
      const foo_foo = edge("foo_foo", foo, foo, "SELF");
      const foo_absent = edge("foo_absent", foo, absent);
      const phantomEdge = edge("spooky", foo, isolated);
      const graph = newGraph()
        .addNode(bar)
        .addNode(foo)
        .addNode(isolated)
        .addEdge(bar_foo)
        .addEdge(foo_foo)
        .addEdge(foo_absent)
        .addEdge(phantomEdge)
        .removeEdge(phantomEdge.address);

      const refFor = (x) => graph.ref(x.address());

      const fooNeighbor = {
        bar: {edge: bar_foo, ref: refFor(bar)},
        absent: {edge: foo_absent, ref: refFor(absent)},
        foo: {edge: foo_foo, ref: refFor(foo)},
      };

      function expectNeighborsEqual(
        actual: Iterable<{|+edge: Edge<any>, +ref: NodeReference|}>,
        expected: {|+edge: Edge<any>, +ref: NodeReference|}[]
      ) {
        const sort = (xs) => sortBy(xs, (x) => stringify(x.edge.address));
        expect(sort(Array.from(actual))).toEqual(sort(expected));
      }

      it("ref in empty graph has no neighbors", () => {
        const ref = newGraph().ref(foo.address());
        expectNeighborsEqual(ref.neighbors(), []);
      });
      it("graph with no edges has no neighbors", () => {
        const g = newGraph()
          .addNode(foo)
          .addNode(bar);
        const ref = g.ref(foo.address());
        expectNeighborsEqual(ref.neighbors(), []);
      });
      it("finds neighbors for an absent node", () => {
        expectNeighborsEqual(refFor(absent).neighbors(), [
          {edge: foo_absent, ref: refFor(foo)},
        ]);
      });
      describe("filters by direction:", () => {
        [
          ["IN", [fooNeighbor.bar, fooNeighbor.foo]],
          ["OUT", [fooNeighbor.absent, fooNeighbor.foo]],
          ["ANY", [fooNeighbor.bar, fooNeighbor.absent, fooNeighbor.foo]],
          [
            "unspecified",
            [fooNeighbor.bar, fooNeighbor.absent, fooNeighbor.foo],
          ],
        ].forEach(([direction, expectedNeighbors]) => {
          it(direction, () => {
            const options = direction === "unspecified" ? {} : {direction};
            expectNeighborsEqual(
              refFor(foo).neighbors(options),
              expectedNeighbors
            );
          });
        });
      });
      describe("filters edges by type:", () => {
        [
          ["EDGE", [fooNeighbor.bar, fooNeighbor.absent]],
          ["SELF", [fooNeighbor.foo]],
          [
            "unspecified",
            [fooNeighbor.bar, fooNeighbor.absent, fooNeighbor.foo],
          ],
        ].forEach(([type, expectedNeighbors]) => {
          it(type, () => {
            const options =
              type === "unspecified"
                ? {}
                : {edge: {plugin: EXAMPLE_PLUGIN_NAME, type}};
            expectNeighborsEqual(
              refFor(foo).neighbors(options),
              expectedNeighbors
            );
          });
        });
      });
      describe("filters nodes by type:", () => {
        [
          ["FOO", [fooNeighbor.foo]],
          ["BAR", [fooNeighbor.bar, fooNeighbor.absent]],
          [
            "unspecified",
            [fooNeighbor.bar, fooNeighbor.absent, fooNeighbor.foo],
          ],
        ].forEach(([type, expectedNeighbors]) => {
          it(type, () => {
            const options =
              type === "unspecified"
                ? {}
                : {node: {plugin: EXAMPLE_PLUGIN_NAME, type}};
            expectNeighborsEqual(
              refFor(foo).neighbors(options),
              expectedNeighbors
            );
          });
        });
      });
    });
  });

  describe("node", () => {
    const withNode = () => newGraph().addNode(new FooPayload());
    const address = () => new FooPayload().address();
    const theNode = () => {
      const x = withNode().node(address());
      if (x == null) {
        throw new Error("Persuade Flow this is non-null");
      }
      return x;
    };
    it("returns non-null when present", () => {
      expect(theNode()).toEqual(expect.anything());
    });
    it("has an address", () => {
      expect(theNode().address).toEqual(address());
    });
    it("has a ref", () => {
      expect(theNode().ref).toEqual(withNode().ref(address()));
    });
    it("has a payload", () => {
      expect(theNode().payload).toEqual(new FooPayload());
    });
    it("instantiates payload class", () => {
      expect(theNode().payload).toBeInstanceOf(FooPayload);
    });
    it("returns null for an absent address", () => {
      expect(newGraph().node(address())).toEqual(undefined);
    });
  });

  describe("nodes", () => {
    const barPayload = () => new BarPayload(1, "hello");
    const twoNodes = () =>
      newGraph()
        .addNode(new FooPayload())
        .addNode(barPayload());
    const fooNode = () => twoNodes().node(new FooPayload().address());
    const barNode = () => twoNodes().node(barPayload().address());
    it("returns an empty list on empty graph", () => {
      expect(Array.from(newGraph().nodes())).toHaveLength(0);
    });
    it("returns a list containing graph nodes", () => {
      const nodes = Array.from(twoNodes().nodes());
      expectNodesSameSorted(nodes, [fooNode(), barNode()]);
    });
    it("supports filtering by plugin", () => {
      expect(Array.from(twoNodes().nodes({plugin: "xoombiazar"}))).toHaveLength(
        0
      );
      expect(
        Array.from(twoNodes().nodes({plugin: EXAMPLE_PLUGIN_NAME}))
      ).toHaveLength(2);
    });
    it("supports filtering by plugin and type", () => {
      const fooNodes = Array.from(
        twoNodes().nodes({plugin: EXAMPLE_PLUGIN_NAME, type: "FOO"})
      );
      const barNodes = Array.from(
        twoNodes().nodes({plugin: EXAMPLE_PLUGIN_NAME, type: "BAR"})
      );
      expect(fooNodes).toEqual([fooNode()]);
      expect(barNodes).toEqual([barNode()]);
    });
    it("complains if you filter by only type", () => {
      // $ExpectFlowError
      expect(() => Array.from(newGraph().nodes({type: "foo"}))).toThrowError(
        "must filter by plugin"
      );
    });
    it("does not return removed nodes", () => {
      const g = newGraph()
        .addNode(barPayload())
        .removeNode(barPayload().address());
      const nodes = Array.from(g.nodes());
      expect(nodes).toHaveLength(0);
    });
    it("does not include absent nodes with incident edges", () => {
      const g = newGraph()
        .addNode(barPayload())
        .addEdge({
          address: {
            owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"},
            id: "edge",
          },
          src: barPayload().address(),
          dst: new BarPayload(2, "goodbye").address(),
          payload: "I have a source, but no destination",
        });
      expect(Array.from(g.nodes())).toHaveLength(1);
    });
  });

  describe("edge", () => {
    const srcPayload = () => new BarPayload(1, "first");
    const dstPayload = () => new BarPayload(2, "second");
    const edge = ({id = "my-favorite-edge", payload = 12} = {}) => ({
      address: {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"}, id},
      src: srcPayload().address(),
      dst: dstPayload().address(),
      payload,
    });

    it("returns a normal edge", () => {
      expect(
        newGraph()
          .addNode(srcPayload())
          .addNode(dstPayload())
          .addEdge(edge())
          .edge(edge().address)
      ).toEqual(edge());
    });

    it("returns a dangling edge", () => {
      expect(
        newGraph()
          .addEdge(edge())
          .edge(edge().address)
      ).toEqual(edge());
    });

    it("returns `undefined` for an absent edge", () => {
      expect(newGraph().edge(edge().address)).toBe(undefined);
    });

    it("throws for null or undefined address", () => {
      expect(() => {
        newGraph().edge((null: any));
      }).toThrow("null");
      expect(() => {
        newGraph().edge((undefined: any));
      }).toThrow("undefined");
    });
  });

  describe("edges", () => {
    const srcPayload = () => new BarPayload(1, "first");
    const dstPayload = () => new BarPayload(2, "second");
    const edge = () => ({
      address: {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"}, id: "e"},
      src: srcPayload().address(),
      dst: dstPayload().address(),
      payload: 12,
    });

    it("returns an empty iterator for an empty graph", () => {
      expect(Array.from(newGraph().edges())).toEqual([]);
    });

    it("includes a normal edge in the graph", () => {
      expect(
        Array.from(
          newGraph()
            .addNode(srcPayload())
            .addNode(dstPayload())
            .addEdge(edge())
            .edges()
        )
      ).toEqual([edge()]);
    });

    it("includes a dangling edge in the graph", () => {
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .edges()
        )
      ).toEqual([edge()]);
    });

    it("supports filtering by plugin", () => {
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .edges({plugin: "SOMEONE_ELSE"})
        )
      ).toHaveLength(0);
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .edges({plugin: EXAMPLE_PLUGIN_NAME})
        )
      ).toHaveLength(1);
    });

    it("omits removed edges", () => {
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .removeEdge(edge().address)
            .edges()
        )
      ).toHaveLength(0);
    });

    it("supports filtering by plugin and type", () => {
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .edges({plugin: "SOMEONE_ELSE", type: "SOMETHING"})
        )
      ).toHaveLength(0);
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .edges({plugin: EXAMPLE_PLUGIN_NAME, type: "BOUNDARY"})
        )
      ).toHaveLength(0);
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .edges({plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"})
        )
      ).toHaveLength(1);
    });

    it("complains if you filter by only type", () => {
      // $ExpectFlowError
      expect(() => Array.from(newGraph().nodes({type: "FOO"}))).toThrowError(
        "must filter by plugin"
      );
    });
  });

  describe("addNode", () => {
    it("results in retrievable nodes", () => {
      const graph = newGraph().addNode(new FooPayload());
      expect(graph.node(new FooPayload().address())).toEqual(expect.anything());
    });
    it("is idempotent", () => {
      const g1 = newGraph().addNode(new FooPayload());
      const g2 = newGraph()
        .addNode(new FooPayload())
        .addNode(new FooPayload());
      expect(g1.equals(g2)).toBe(true);
      expect(Array.from(g1.nodes())).toEqual(Array.from(g2.nodes()));
    });
    it("throws an error if distinct payloads with the same address are added", () => {
      const fail = () =>
        newGraph()
          .addNode(new BarPayload(1, "why hello"))
          .addNode(new BarPayload(1, "there"));
      expect(fail).toThrow("exists with distinct contents");
    });
    it("errors for null or undefined payload", () => {
      expect(() => newGraph().addNode((null: any))).toThrow("null");
      expect(() => newGraph().addNode((undefined: any))).toThrow("undefined");
    });
  });

  describe("removeNode", () => {
    it("removing a nonexistent node is not an error", () => {
      const g = newGraph().removeNode(new FooPayload().address());
      expect(g.equals(newGraph())).toBe(true);
    });
    it("removed nodes are not accessible", () => {
      const g = newGraph().addNode(new FooPayload());
      const address = new FooPayload().address();
      const ref = g.ref(address);
      g.removeNode(address);
      expect(ref.get()).toEqual(undefined);
      expect(g.node(address)).toEqual(undefined);
    });
  });

  describe("addEdge", () => {
    const srcPayload = () => new BarPayload(1, "first");
    const dstPayload = () => new BarPayload(2, "second");
    const edge = ({id = "my-favorite-edge", payload = 12} = {}) => ({
      address: {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"}, id},
      src: srcPayload().address(),
      dst: dstPayload().address(),
      payload,
    });

    it("adds an edge between two existing nodes", () => {
      expect(
        Array.from(
          newGraph()
            .addNode(srcPayload())
            .addNode(dstPayload())
            .addEdge(edge())
            .edges()
        )
      ).toEqual([edge()]);
    });

    it("is idempotent", () => {
      expect(
        Array.from(
          newGraph()
            .addNode(srcPayload())
            .addNode(dstPayload())
            .addEdge(edge())
            .addEdge(edge())
            .edges()
        )
      ).toEqual([edge()]);
    });

    it("throws an error for a payload conflict at a given address", () => {
      const e1 = edge({id: "my-edge", payload: "uh"});
      const e2 = edge({id: "my-edge", payload: "oh"});
      const g = newGraph()
        .addNode(srcPayload())
        .addNode(dstPayload())
        .addEdge(e1);
      expect(() => {
        g.addEdge(e2);
      }).toThrow("exists with distinct contents");
    });

    it("adds an edge whose `src` is not present", () => {
      expect(
        Array.from(
          newGraph()
            .addNode(dstPayload())
            .addEdge(edge())
            .edges()
        )
      ).toEqual([edge()]);
    });

    it("adds an edge whose `dst` is not present", () => {
      expect(
        Array.from(
          newGraph()
            .addNode(srcPayload())
            .addEdge(edge())
            .edges()
        )
      ).toEqual([edge()]);
    });

    it("adds an edge whose `src` and `dst` are not present", () => {
      expect(
        Array.from(
          newGraph()
            .addEdge(edge())
            .edges()
        )
      ).toEqual([edge()]);
    });

    it("adds a loop", () => {
      const e = {...edge(), dst: srcPayload().address()};
      expect(
        Array.from(
          newGraph()
            .addNode(srcPayload())
            .addEdge(e)
            .edges()
        )
      ).toEqual([e]);
    });

    it("throws for null or undefined edge", () => {
      expect(() => {
        newGraph().addEdge((null: any));
      }).toThrow("null");
      expect(() => {
        newGraph().addEdge((undefined: any));
      }).toThrow("undefined");
    });

    it("throws for null or undefined address", () => {
      const e = (address: any) => ({...edge(), address});
      expect(() => {
        newGraph().addEdge(e(null));
      }).toThrow("null");
      expect(() => {
        newGraph().addEdge(e(undefined));
      }).toThrow("undefined");
    });

    it("throws for null or undefined src", () => {
      const e = (src: any) => ({...edge(), src});
      expect(() => {
        newGraph().addEdge(e(null));
      }).toThrow("null");
      expect(() => {
        newGraph().addEdge(e(undefined));
      }).toThrow("undefined");
    });

    it("throws for null or undefined dst", () => {
      const e = (dst: any) => ({...edge(), dst});
      expect(() => {
        newGraph().addEdge(e(null));
      }).toThrow("null");
      expect(() => {
        newGraph().addEdge(e(undefined));
      }).toThrow("undefined");
    });
  });

  describe("removeEdge", () => {
    it("removes a nonexistent edge without error", () => {
      newGraph().removeEdge({
        owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"},
        id: "nope",
      });
    });

    it("throws for null or undefined address", () => {
      expect(() => {
        newGraph().removeEdge((null: any));
      }).toThrow("null");
      expect(() => {
        newGraph().removeEdge((undefined: any));
      }).toThrow("undefined");
    });
  });

  describe("mergeConservative", () => {
    const merge = (graphs) => Graph.mergeConservative([new Handler()], graphs);

    it("installs appropriate plugin handlers", () => {
      const plugins = [new Handler()];
      expect(Graph.mergeConservative(plugins, []).plugins()).toEqual(plugins);
    });

    it("yields the empty graph on empty input", () => {
      expect(merge([]).equals(newGraph())).toBe(true);
    });

    it("is the identity on a singleton input", () => {
      const g = () =>
        newGraph()
          .addNode(new FooPayload())
          .addEdge({
            address: {
              owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"},
              id: "edge",
            },
            src: new FooPayload().address(),
            dst: new BarPayload(1, "hello").address(),
            payload: "nothing",
          });
      expect(merge([g()]).equals(g())).toBe(true);
    });

    it("merges two graphs with nontrivial intersection", () => {
      const nodes = {
        a: () => new BarPayload(1, "alpha"),
        b: () => new BarPayload(2, "bravo"),
        absent: () => new FooPayload(),
      };
      const edge = (srcPayload, dstPayload, id): Edge<string> => ({
        address: {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"}, id},
        src: srcPayload.address(),
        dst: dstPayload.address(),
        payload: "not much",
      });
      const edges: {[string]: () => Edge<string>} = {
        a_b: () => edge(nodes.a(), nodes.b(), "a_b"),
        a_absent: () => edge(nodes.a(), nodes.absent(), "a_absent"),
        b_absent: () => edge(nodes.b(), nodes.absent(), "b_absent"),
      };
      const g = newGraph()
        .addNode(nodes.a())
        .addEdge(edges.a_b())
        .addEdge(edges.a_absent());
      const h = newGraph()
        .addNode(nodes.b())
        .addEdge(edges.a_b())
        .addEdge(edges.b_absent());
      const merged = merge([g, h]);
      const expected = newGraph()
        .addNode(nodes.a())
        .addNode(nodes.b())
        .addEdge(edges.a_b())
        .addEdge(edges.a_absent())
        .addEdge(edges.b_absent());
      expect(merged.equals(expected)).toBe(true);
    });

    it("rejects graphs with conflicting nodes", () => {
      const g = newGraph().addNode(new BarPayload(1, "hello"));
      const h = newGraph().addNode(new BarPayload(1, "there"));
      expect(() => {
        merge([g, h]);
      }).toThrow(/node.*exists with distinct contents/);
    });

    it("rejects graphs with conflicting edges", () => {
      const e = (payload) => ({
        address: {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"}, id: "e"},
        src: new FooPayload().address(),
        dst: new FooPayload().address(),
        payload,
      });
      const g = newGraph().addEdge(e(1));
      const h = newGraph().addEdge(e(2));
      expect(() => {
        merge([g, h]);
      }).toThrow(/edge.*exists with distinct contents/);
    });

    it("copies its input", () => {
      const g = newGraph();
      const h = merge([g]);
      expect(g).not.toBe(h);
      g.addNode(new FooPayload());
      expect(g.equals(h)).toBe(false);
    });

    it("yields `ref`s pointing to the proper graphs", () => {
      const g = newGraph().addNode(new FooPayload());
      const gRef = g.ref(new FooPayload().address());
      const h = merge([g]);
      const hRef = h.ref(new FooPayload().address());
      expect(gRef.graph()).toBe(g);
      expect(hRef.graph()).toBe(h);
    });
  });

  describe("equals", () => {
    const srcPayload = () => new BarPayload(1, "first");
    const dstPayload = () => new BarPayload(2, "second");
    const edge = (payload) => ({
      address: {owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"}, id: "e"},
      src: srcPayload().address(),
      dst: dstPayload().address(),
      payload,
    });

    it("empty graphs are equal", () => {
      expect(newGraph().equals(newGraph())).toBe(true);
    });
    it("graphs may be equal despite distinct plugin handlers", () => {
      const g0 = new Graph([]);
      const g1 = new Graph([new Handler()]);
      expect(g0.equals(g1)).toBe(true);
    });
    it("graphs with different nodes are not equal", () => {
      const g0 = newGraph().addNode(new FooPayload());
      const g1 = newGraph().addNode(new BarPayload(1, "hello"));
      expect(g0.equals(g1)).toBe(false);
    });
    it("graphs with different payloads at same address are not equal", () => {
      const g0 = newGraph().addNode(new BarPayload(1, "hello"));
      const g1 = newGraph().addNode(new BarPayload(1, "there"));
      expect(g0.equals(g1)).toBe(false);
    });
    it("graphs with different edges are not equal", () => {
      const g0 = newGraph();
      const g1 = newGraph().addEdge(edge("hello"));
      expect(g0.equals(g1)).toBe(false);
    });
    it("graphs with different edges at same address are not equal", () => {
      const g0 = newGraph().addEdge(edge("hello"));
      const g1 = newGraph().addEdge(edge("there"));
      expect(g0.equals(g1)).toBe(false);
    });
    it("adding and removing a node doesn't change equality", () => {
      const g = newGraph().addNode(new BarPayload(1, "along for the ride"));
      const h = newGraph()
        .addNode(new BarPayload(1, "along for the ride"))
        .addNode(new FooPayload())
        .removeNode(new FooPayload().address());
      expect(g.equals(h)).toBe(true);
    });
    it("adding and removing an edge doesn't change equality", () => {
      const g = newGraph()
        .addEdge(edge("hello"))
        .removeEdge(edge("hello").address);
      expect(g.equals(newGraph())).toBe(true);
    });
  });

  describe("copy", () => {
    it("yields a reference-distinct but logically-equal graph", () => {
      const g = newGraph()
        .addNode(new FooPayload())
        .addEdge({
          address: {
            owner: {plugin: EXAMPLE_PLUGIN_NAME, type: "EDGE"},
            id: "e",
          },
          src: new BarPayload(1, "hello").address(),
          dst: new BarPayload(2, "there").address(),
          payload: "stuff",
        });
      const h = g.copy();
      expect(g).not.toBe(h);
      expect(g.equals(h)).toBe(true);
      expect(g.plugins()).toEqual(h.plugins());
    });

    it("allows independent mutation of the original and copied graphs", () => {
      const g = newGraph();
      const h = g.copy();
      g.addNode(new FooPayload());
      expect(g.equals(h)).toBe(false);
    });
  });
});

describe("DelegateNodeReference", () => {
  const makeBase = () => ({
    graph: jest.fn(),
    address: jest.fn(),
    get: jest.fn(),
    neighbors: jest.fn(),
  });

  it("has a working constructor", () => {
    expect(new DelegateNodeReference(makeBase())).toBeInstanceOf(
      DelegateNodeReference
    );
  });

  it("delegates `graph`", () => {
    const expected = new Graph([]);
    const ref = {
      ...makeBase(),
      graph: jest.fn().mockReturnValueOnce(expected),
    };
    expect(new DelegateNodeReference(ref).graph()).toBe(expected);
    expect(ref.graph.mock.calls).toEqual([[]]);
  });

  it("delegates `address`", () => {
    const expected = {owner: {plugin: "foo", type: "bar"}, id: "baz"};
    const ref = {
      ...makeBase(),
      address: jest.fn().mockReturnValueOnce(expected),
    };
    expect(new DelegateNodeReference(ref).address()).toBe(expected);
    expect(ref.address.mock.calls).toEqual([[]]);
  });

  it("delegates `get`", () => {
    const expected = {some: "node"};
    const ref = {
      ...makeBase(),
      get: jest.fn().mockReturnValueOnce((expected: any)),
    };
    expect(new DelegateNodeReference(ref).get()).toBe(expected);
    expect(ref.get.mock.calls).toEqual([[]]);
  });

  it("delegates `neighbors`, with proper options", () => {
    const options = {direction: "OUT", node: {plugin: "foo", type: "bar"}};
    const ref = {
      ...makeBase(),
      neighbors: jest.fn().mockImplementationOnce((...args) => (args: any)),
    };
    const result = new DelegateNodeReference(ref).neighbors(options);
    expect(result).toEqual([options]);
    expect(ref.neighbors.mock.calls).toEqual([[options]]);
  });
});
