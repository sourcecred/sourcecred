// @flow

import * as Weights from "./weights";
import {Graph, NodeAddress, EdgeAddress} from "./graph";
import * as WeightedGraph from "./weightedGraph";
import * as GraphTest from "./graphTestUtil";

describe("core/weightedGraph", () => {
  function expectEqual(wg1, wg2) {
    expect(wg1.graph.equals(wg2.graph)).toBe(true);
    expect(wg1.weights).toEqual(wg2.weights);
  }
  const foo = GraphTest.node("foo");
  const bar = GraphTest.node("bar");
  const foobar = GraphTest.edge("foobar", foo, bar);

  describe("empty", () => {
    it("empty produces an empty WeightedGraph", () => {
      const {weights, graph} = WeightedGraph.empty();
      expect(graph.equals(new Graph())).toBe(true);
      expect(weights).toEqual(Weights.empty());
    });
  });

  describe("toJSON/fromJSON", () => {
    it("works for an empty WeightedGraph", () => {
      const wg = WeightedGraph.empty();
      const wgJSON = WeightedGraph.toJSON(wg);
      const wg_ = WeightedGraph.fromJSON(wgJSON);
      expectEqual(wg, wg_);
    });
    it("works for a non-empty WeightedGraph", () => {
      const node = GraphTest.node("foo");
      const graph = new Graph().addNode(node);
      const weights = Weights.empty();
      weights.nodeWeights.set(node.address, 5);
      const wg = {graph, weights};
      const wgJSON = WeightedGraph.toJSON(wg);
      const wg_ = WeightedGraph.fromJSON(wgJSON);
      expectEqual(wg, wg_);
    });
  });

  describe("merge", () => {
    it("merge works on nontrivial graph", () => {
      // Not attempting to validate edge case semantics here, since this is just
      // a wrapper around Graph.merge and WeightedGraph.merge; those functions
      // are tested more thoroughly.
      const g1 = new Graph().addNode(foo);
      const g2 = new Graph().addNode(bar);
      const w1 = Weights.empty();
      w1.nodeWeights.set(foo.address, 1);
      const w2 = Weights.empty();
      w2.nodeWeights.set(bar.address, 2);
      const wg1 = {graph: g1, weights: w1};
      const wg2 = {graph: g2, weights: w2};
      const g = Graph.merge([g1, g2]);
      const w = Weights.merge([w1, w2]);
      const wg = WeightedGraph.merge([wg1, wg2]);
      const wg_ = {weights: w, graph: g};
      expectEqual(wg, wg_);
    });
  });

  describe("overrideWeights", () => {
    const example = () => {
      const graph = new Graph().addNode(foo).addNode(bar);
      const weights = Weights.empty();
      weights.nodeWeights.set(NodeAddress.empty, 0);
      weights.nodeWeights.set(foo.address, 1);
      weights.edgeWeights.set(foobar.address, {forwards: 2, backwards: 2});
      weights.edgeWeights.set(EdgeAddress.empty, {forwards: 3, backwards: 3});
      return {graph, weights};
    };
    it("has no effect if the overrides are empty", () => {
      const g1 = example();
      const g2 = WeightedGraph.overrideWeights(g1, Weights.empty());
      expectEqual(g1, g2);
    });
    it("takes weights from base and overrides, choosing overrides on conflicts", () => {
      const overrides = Weights.empty();
      overrides.nodeWeights.set(foo.address, 101);
      overrides.nodeWeights.set(bar.address, 102);
      overrides.edgeWeights.set(foobar.address, {
        forwards: 103,
        backwards: 103,
      });
      const expected = Weights.empty();
      expected.nodeWeights.set(NodeAddress.empty, 0);
      expected.nodeWeights.set(foo.address, 101);
      expected.nodeWeights.set(bar.address, 102);
      expected.edgeWeights.set(foobar.address, {forwards: 103, backwards: 103});
      expected.edgeWeights.set(EdgeAddress.empty, {forwards: 3, backwards: 3});
      const actual = WeightedGraph.overrideWeights(example(), overrides)
        .weights;
      expect(expected).toEqual(actual);
    });
  });
  describe("compareWeightedGraphs", () => {
    const src = GraphTest.node("src");
    const dst = GraphTest.node("dst");
    const simpleEdge = GraphTest.edge("edge", src, dst);
    const simpleEdgeWeight = {forwards: 1, backwards: 2};
    const getSimpleWeightedGraph = () =>
      GraphTest.testWeightedGraph(
        [
          {node: src, weight: 1},
          {node: dst, weight: 2},
        ],
        [{edge: simpleEdge, weight: simpleEdgeWeight}]
      );

    describe("simple graphs are equal with no differences", () => {
      const weightedGraph1 = getSimpleWeightedGraph();
      const weightedGraph2 = getSimpleWeightedGraph();

      it("returns empty arrays", () => {
        const expected = {
          weightedGraphsAreEqual: true,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("advanced graphs are equal with no differences", () => {
      const advanced = GraphTest.advancedGraph();
      const weights1 = Weights.empty();
      weights1.nodeWeights.set(advanced.nodes.src.address, 1);
      weights1.nodeWeights.set(advanced.nodes.dst.address, 2);
      weights1.nodeWeights.set(advanced.nodes.isolated.address, 3);
      weights1.nodeWeights.set(advanced.nodes.halfIsolated.address, 4);
      weights1.nodeWeights.set(advanced.nodes.loop.address, 5);
      weights1.edgeWeights.set(advanced.edges.hom1.address, simpleEdgeWeight);
      weights1.edgeWeights.set(advanced.edges.hom2.address, {
        forwards: 3,
        backwards: 4,
      });
      weights1.edgeWeights.set(advanced.edges.fullDanglingEdge.address, {
        forwards: 5,
        backwards: 6,
      });
      weights1.edgeWeights.set(advanced.edges.halfDanglingEdge.address, {
        forwards: 7,
        backwards: 8,
      });
      weights1.edgeWeights.set(advanced.edges.loopLoop.address, {
        forwards: 9,
        backwards: 1,
      });
      const weights2 = Weights.copy(weights1);
      const weightedGraph1 = {graph: advanced.graph1(), weights: weights1};
      const weightedGraph2 = {graph: advanced.graph2(), weights: weights2};

      it("returns empty arrays", () => {
        const expected = {
          weightedGraphsAreEqual: true,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("each graph has unique full dangling edge", () => {
      const danglingEdge = GraphTest.edge(
        "dangling edge",
        GraphTest.node("unknown src"),
        GraphTest.node("unknown dst")
      );
      const danglingEdge2 = GraphTest.edge(
        "dangling edge 2",
        GraphTest.node("unknown src"),
        GraphTest.node("unknown dst")
      );
      const weightedGraph1 = getSimpleWeightedGraph();
      weightedGraph1.graph.addEdge(danglingEdge);
      weightedGraph1.weights.edgeWeights.set(
        danglingEdge.address,
        simpleEdgeWeight
      );
      const weightedGraph2 = getSimpleWeightedGraph();
      weightedGraph2.graph.addEdge(danglingEdge2);
      weightedGraph2.weights.edgeWeights.set(
        danglingEdge2.address,
        simpleEdgeWeight
      );

      it("returns unique dangling edge", () => {
        const expected = {
          weightedGraphsAreEqual: false,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [{edge: danglingEdge, weight: simpleEdgeWeight}],
          uniqueEdgesInSecond: [
            {edge: danglingEdge2, weight: simpleEdgeWeight},
          ],
          edgeTuplesWithDifferences: [],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("first graph has unique contents", () => {
      const graph2 = new Graph().addNode(src);
      const weights2 = Weights.empty();
      weights2.nodeWeights.set(src.address, 1);
      const weightedGraph1 = getSimpleWeightedGraph();
      const weightedGraph2 = {graph: graph2, weights: weights2};

      it("returns unique contents", () => {
        const expected = {
          weightedGraphsAreEqual: false,
          uniqueNodesInFirst: [{node: dst, weight: 2}],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [{edge: simpleEdge, weight: simpleEdgeWeight}],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("second graph has unique contents", () => {
      const weightedGraph1 = GraphTest.testWeightedGraph(
        [{node: src, weight: 1}],
        []
      );
      const weightedGraph2 = getSimpleWeightedGraph();

      it("returns unique contents", () => {
        const expected = {
          weightedGraphsAreEqual: false,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [{node: dst, weight: 2}],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [{edge: simpleEdge, weight: simpleEdgeWeight}],
          edgeTuplesWithDifferences: [],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("attribute differences", () => {
      const dst2 = {
        address: NodeAddress.fromParts(["dst"]),
        description: "unique description",
        timestampMs: null,
      };
      const simpleEdge2 = GraphTest.edge(
        "edge",
        src,
        GraphTest.node("unique dst")
      );
      const weightedGraph1 = getSimpleWeightedGraph();
      const weightedGraph2 = GraphTest.testWeightedGraph(
        [
          {node: src, weight: 1},
          {node: dst2, weight: 2},
        ],
        [{edge: simpleEdge2, weight: simpleEdgeWeight}]
      );

      it("returns tuples with differences", () => {
        const expected = {
          weightedGraphsAreEqual: false,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [
            [
              {node: dst, weight: 2},
              {node: dst2, weight: 2},
            ],
          ],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [
            [
              {edge: simpleEdge, weight: simpleEdgeWeight},
              {edge: simpleEdge2, weight: simpleEdgeWeight},
            ],
          ],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("weight differences", () => {
      const weightedGraph1 = getSimpleWeightedGraph();
      const weightedGraph2 = GraphTest.testWeightedGraph(
        [
          {node: src, weight: 1},
          {node: dst, weight: 22},
        ],
        [{edge: simpleEdge, weight: {forwards: 6, backwards: 8}}]
      );

      it("returns tuples with differences", () => {
        const expected = {
          weightedGraphsAreEqual: false,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [
            [
              {node: dst, weight: 2},
              {node: dst, weight: 22},
            ],
          ],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [
            [
              {edge: simpleEdge, weight: simpleEdgeWeight},
              {edge: simpleEdge, weight: {forwards: 6, backwards: 8}},
            ],
          ],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("equal graphs have missing weights", () => {
      const weightedGraph1 = getSimpleWeightedGraph();
      const weightedGraph2 = getSimpleWeightedGraph();
      weightedGraph1.graph.addNode(GraphTest.node("noWeightN"));
      weightedGraph2.graph.addNode(GraphTest.node("noWeightN"));
      weightedGraph1.graph.addEdge(GraphTest.edge("noWeightE", src, dst));
      weightedGraph2.graph.addEdge(GraphTest.edge("noWeightE", src, dst));

      it("returns empty arrays", () => {
        const expected = {
          weightedGraphsAreEqual: true,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });

    describe("first graph has missing weights", () => {
      const weightedGraph1 = getSimpleWeightedGraph();
      const weightedGraph2 = getSimpleWeightedGraph();
      weightedGraph1.weights.nodeWeights.delete(dst.address);
      weightedGraph1.weights.edgeWeights.delete(simpleEdge.address);

      it("returns tuples with differences", () => {
        const expected = {
          weightedGraphsAreEqual: false,
          uniqueNodesInFirst: [],
          uniqueNodesInSecond: [],
          nodeTuplesWithDifferences: [
            [
              {node: dst, weight: undefined},
              {node: dst, weight: 2},
            ],
          ],
          uniqueEdgesInFirst: [],
          uniqueEdgesInSecond: [],
          edgeTuplesWithDifferences: [
            [
              {edge: simpleEdge, weight: undefined},
              {edge: simpleEdge, weight: simpleEdgeWeight},
            ],
          ],
        };
        expect(
          WeightedGraph.compareWeightedGraphs(weightedGraph1, weightedGraph2)
        ).toEqual(expected);
      });
    });
  });
});
