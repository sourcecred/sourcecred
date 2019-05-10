// @flow

import {OdysseyInstance} from "./instance";
import {EdgeAddress, NodeAddress, Direction} from "../../core/graph";

describe("plugins/odyssey/instance", () => {
  function exampleInstance() {
    const instance = new OdysseyInstance("my example instance");
    const me = instance.addNode("PERSON", "me");
    const you = instance.addNode("PERSON", "you");
    const value = instance.addNode("VALUE", "valuable-ness");
    const contribution = instance.addNode("CONTRIBUTION", "a good deed");
    const artifact = instance.addNode(
      "ARTIFACT",
      "the thing that creates value"
    );

    // first off I'd like to thank myself
    instance
      .addEdge("DEPENDS_ON", me, me)
      // thank you for your support
      .addEdge("DEPENDS_ON", me, you)
      .addEdge("DEPENDS_ON", contribution, me)
      .addEdge("DEPENDS_ON", artifact, contribution)
      .addEdge("DEPENDS_ON", value, artifact);
    return {instance, you, me, value, contribution, artifact};
  }
  it("can retrieve the name", () => {
    const {instance} = exampleInstance();
    expect(instance.name()).toEqual("my example instance");
  });
  it("can retrieve the graph", () => {
    const {instance, me} = exampleInstance();
    const graph = instance.graph();
    const nodes = Array.from(graph.nodes());
    const edges = Array.from(graph.edges());
    expect(nodes).toHaveLength(5);
    expect(edges).toHaveLength(5);
    const myNeighbors = graph.neighbors(me.address, {
      direction: Direction.ANY,
      nodePrefix: NodeAddress.empty,
      edgePrefix: EdgeAddress.empty,
    });
    expect(Array.from(myNeighbors)).toHaveLength(3);
  });
  it("retrieved graph is a copy", () => {
    const {instance} = exampleInstance();
    expect(instance.graph()).not.toBe(instance.graph());
  });
  it("returns nodes as they are added", () => {
    const {me} = exampleInstance();
    expect(me).toEqual({
      address: NodeAddress.fromParts(["sourcecred", "odyssey", "PERSON", "0"]),
      nodeTypeIdentifier: "PERSON",
      description: "me",
    });
  });
  it("can retrieve nodes by address", () => {
    const {instance, me} = exampleInstance();
    expect(instance.node(me.address)).toEqual(me);
  });
  it("returns null for non-existent node", () => {
    const instance = new OdysseyInstance("nameless");
    expect(instance.node(NodeAddress.empty)).toEqual(null);
  });
  it("throws an error when adding an node with bad type", () => {
    const instance = new OdysseyInstance("nameless");
    // $ExpectFlowError
    expect(() => instance.addNode("FOO", "foo")).toThrowError(
      "invalid type identifier: FOO"
    );
  });
  it("can retrieve all nodes", () => {
    const {instance} = exampleInstance();
    expect(Array.from(instance.nodes())).toHaveLength(5);
  });
  it("can retrieve nodes by type", () => {
    const {instance, artifact, contribution, value} = exampleInstance();
    expect(Array.from(instance.nodes("ARTIFACT"))).toEqual([artifact]);
    expect(Array.from(instance.nodes("VALUE"))).toEqual([value]);
    expect(Array.from(instance.nodes("CONTRIBUTION"))).toEqual([contribution]);
    // $ExpectFlowError
    expect(Array.from(instance.nodes("NONEXISTENT"))).toEqual([]);
  });
  it("errors if adding edge between Nodes that don't exist", () => {
    const {me, you} = exampleInstance();
    const i = new OdysseyInstance("nameless");
    expect(() => i.addEdge("DEPENDS_ON", me, you)).toThrowError(
      "Missing src on edge:"
    );
  });
  describe("equality", () => {
    it("empty instance isHistoricallyIdentical empty instance", () => {
      const a = new OdysseyInstance("nameless");
      const b = new OdysseyInstance("nameless");
      expect(a.isHistoricallyIdentical(b)).toBe(true);
    });
    it("instances with different names are not identical", () => {
      const a = new OdysseyInstance("foo");
      const b = new OdysseyInstance("bar");
      expect(a.isHistoricallyIdentical(b)).toBe(false);
    });
    it("empty instance does not equal nonempty instance", () => {
      const a = new OdysseyInstance("foo");
      a.addNode("PERSON", "me");
      const b = new OdysseyInstance("foo");
      expect(a.isHistoricallyIdentical(b)).toBe(false);
    });
    it("complex but identically generated instances are equal", () => {
      const {instance: a} = exampleInstance();
      const {instance: b} = exampleInstance();
      expect(a.isHistoricallyIdentical(b)).toBe(true);
    });
    it("instances with different descriptions are not equal", () => {
      const a = new OdysseyInstance("foo");
      const b = new OdysseyInstance("foo");
      a.addNode("PERSON", "me");
      b.addNode("PERSON", "me2");
      expect(a.isHistoricallyIdentical(b)).toBe(false);
    });
    it("instances with different types are not equal", () => {
      const a = new OdysseyInstance("foo");
      const b = new OdysseyInstance("foo");
      a.addNode("PERSON", "me");
      b.addNode("ARTIFACT", "me");
      expect(a.isHistoricallyIdentical(b)).toBe(false);
    });
    it("instances with different edges are not equal", () => {
      const a = new OdysseyInstance("foo");
      const b = new OdysseyInstance("foo");
      const me = a.addNode("PERSON", "me");
      b.addNode("PERSON", "me");
      a.addEdge("DEPENDS_ON", me, me);
      expect(a.isHistoricallyIdentical(b)).toBe(false);
    });
    it("instances with different histories are not equal", () => {
      const i1 = new OdysseyInstance("foo");
      i1.addNode("PERSON", "me");
      i1.addNode("PERSON", "you");

      const i2 = new OdysseyInstance("foo");
      i2.addNode("PERSON", "you");
      i2.addNode("PERSON", "me");

      expect(i1.isHistoricallyIdentical(i2)).toBe(false);
    });
  });
  describe("to/from JSON", () => {
    it("to->fro is identity", () => {
      const {instance} = exampleInstance();
      const instance2 = OdysseyInstance.fromJSON(instance.toJSON());
      expect(instance.isHistoricallyIdentical(instance2)).toBe(true);
    });
    it("fro->to is identity", () => {
      const {instance} = exampleInstance();
      const json1 = instance.toJSON();
      const json2 = OdysseyInstance.fromJSON(json1).toJSON();
      expect(json1).toEqual(json2);
    });
  });
});
