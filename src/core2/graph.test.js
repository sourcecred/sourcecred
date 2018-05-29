// @flow
import stringify from "json-stable-stringify";
import sortBy from "lodash.sortby";

import type {Node} from "./graph";
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

  describe("equals", () => {
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
    it("adding and removing a node doesn't change equality", () => {
      const g = newGraph()
        .addNode(new FooPayload())
        .removeNode(new FooPayload().address());
      expect(g.equals(newGraph())).toBe(true);
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
