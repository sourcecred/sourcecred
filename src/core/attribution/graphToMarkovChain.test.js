// @flow

import sortBy from "lodash.sortby";

import {EdgeAddress, Graph, NodeAddress, Direction} from "../graph";
import {
  distributionToNodeDistribution,
  createConnections,
  createOrderedSparseMarkovChain,
  normalize,
  normalizeNeighbors,
  permute,
  createWeightedGraph,
} from "./graphToMarkovChain";
import * as MapUtil from "../../util/map";
import * as NullUtil from "../../util/null";

import {advancedGraph} from "../graphTestUtil";

describe("core/attribution/graphToMarkovChain", () => {
  describe("permute", () => {
    const n1 = NodeAddress.fromParts(["n1"]);
    const n2 = NodeAddress.fromParts(["n2"]);
    const n3 = NodeAddress.fromParts(["n3"]);
    // This chain isn't a proper stochastic chain, but that's okay:
    // the actual values aren't relevant.
    const old = {
      nodeOrder: [n1, n2, n3],
      chain: [
        {
          neighbor: new Uint32Array([0, 1]),
          weight: new Float64Array([0.2, 0.8]),
        },
        {neighbor: new Uint32Array([2]), weight: new Float64Array([0.9])},
        {neighbor: new Uint32Array([]), weight: new Float64Array([])},
      ],
    };
    const newOrder = [n2, n3, n1];
    const actual = permute(old, newOrder);
    const expected = {
      nodeOrder: [n2, n3, n1],
      chain: [
        {neighbor: new Uint32Array([1]), weight: new Float64Array([0.9])},
        {neighbor: new Uint32Array([]), weight: new Float64Array([])},
        {
          neighbor: new Uint32Array([2, 0]),
          weight: new Float64Array([0.2, 0.8]),
        },
      ],
    };
    expect(actual).toEqual(expected);
  });

  describe("normalizeNeighbors", () => {
    const n1 = NodeAddress.fromParts(["n1"]);
    const n2 = NodeAddress.fromParts(["n2"]);
    const n3 = NodeAddress.fromParts(["n3"]);
    // This chain isn't a proper stochastic chain, but that's okay:
    // the actual values aren't relevant.
    const old = {
      nodeOrder: [n2, n3, n1],
      chain: [
        {neighbor: new Uint32Array([1]), weight: new Float64Array([0.9])},
        {neighbor: new Uint32Array([]), weight: new Float64Array([])},
        {
          neighbor: new Uint32Array([2, 0]),
          weight: new Float64Array([0.2, 0.8]),
        },
      ],
    };
    const actual = normalizeNeighbors(old);
    const expected = {
      nodeOrder: [n2, n3, n1],
      chain: [
        {neighbor: new Uint32Array([1]), weight: new Float64Array([0.9])},
        {neighbor: new Uint32Array([]), weight: new Float64Array([])},
        {
          neighbor: new Uint32Array([0, 2]),
          weight: new Float64Array([0.8, 0.2]),
        },
      ],
    };
    expect(actual).toEqual(expected);
  });

  describe("createWeightedGraph", () => {
    // I made this slightly convoluted evaluator to reduce the liklihood
    // that tests pass accidentally :)
    const edgeEvaluator = ({src, dst, address}) => ({
      toWeight: src.length + address.length,
      froWeight: dst.length + address.length,
    });
    it("keeps a pointer to the same graph", () => {
      const g = advancedGraph().graph2();
      const wg = createWeightedGraph(g, edgeEvaluator, 0.01);
      expect(wg.graph).toBe(g);
    });
    it("creates a 1-1 mapping between edge addresses and weights", () => {
      const g = advancedGraph().graph2();
      const wg = createWeightedGraph(g, edgeEvaluator, 0.01);
      let nEdges = 0;
      for (const e of g.edges()) {
        nEdges++;
        const w = edgeEvaluator(e);
        expect(w).toEqual(wg.edgeWeights.get(e.address));
      }
      expect(nEdges).toEqual(wg.edgeWeights.size);
    });
    it("passes through the self loop weight", () => {
      const selfLoopWeight = 0.0707;
      const wg = createWeightedGraph(
        advancedGraph().graph2(),
        edgeEvaluator,
        selfLoopWeight
      );
      expect(selfLoopWeight).toEqual(wg.syntheticLoopWeight);
    });
    it("correctly computes nodeTotalWeights", () => {
      const selfLoopWeight = 0.0707;
      const wg = createWeightedGraph(
        advancedGraph().graph2(),
        edgeEvaluator,
        selfLoopWeight
      );
      for (const node of wg.graph.nodes()) {
        let outWeight = selfLoopWeight;
        const options = {
          direction: Direction.ANY,
          nodePrefix: NodeAddress.empty,
          edgePrefix: EdgeAddress.empty,
        };
        for (const {edge} of wg.graph.neighbors(node, options)) {
          const {toWeight, froWeight} = NullUtil.get(
            wg.edgeWeights.get(edge.address)
          );
          if (edge.src === node) {
            outWeight += toWeight;
          }
          if (edge.dst === node) {
            outWeight += froWeight;
          }
        }
        expect(wg.nodeTotalOutWeights.get(node)).toEqual(outWeight);
      }
    });
  });

  describe("createConnections", () => {
    // The tests for `createOrderedSparseMarkovChain` also must invoke
    // `createConnections`, so we add only light testing separately.
    it("works on a simple asymmetric chain", () => {
      const n1 = NodeAddress.fromParts(["n1"]);
      const n2 = NodeAddress.fromParts(["n2"]);
      const n3 = NodeAddress.fromParts(["sink"]);
      const e1 = {src: n1, dst: n2, address: EdgeAddress.fromParts(["e1"])};
      const e2 = {src: n2, dst: n3, address: EdgeAddress.fromParts(["e2"])};
      const e3 = {src: n1, dst: n3, address: EdgeAddress.fromParts(["e3"])};
      const e4 = {src: n3, dst: n3, address: EdgeAddress.fromParts(["e4"])};
      const g = new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addEdge(e1)
        .addEdge(e2)
        .addEdge(e3)
        .addEdge(e4);
      const edgeWeight = () => ({toWeight: 6.0, froWeight: 3.0});
      const actual = createConnections(createWeightedGraph(g, edgeWeight, 1.0));
      // Total out-weights (for normalization factors):
      //   - for `n1`: 2 out, 0 in, 1 synthetic: 12 + 0 + 1 = 13
      //   - for `n2`: 1 out, 1 in, 1 synthetic: 6 + 3 + 1 = 10
      //   - for `n3`: 1 out, 3 in, 1 synthetic: 6 + 9 + 1 = 16
      const expected = new Map()
        .set(n1, [
          {adjacency: {type: "SYNTHETIC_LOOP"}, weight: 1 / 13},
          {adjacency: {type: "OUT_EDGE", edge: e1}, weight: 3 / 10},
          {adjacency: {type: "OUT_EDGE", edge: e3}, weight: 3 / 16},
        ])
        .set(n2, [
          {adjacency: {type: "SYNTHETIC_LOOP"}, weight: 1 / 10},
          {adjacency: {type: "IN_EDGE", edge: e1}, weight: 6 / 13},
          {adjacency: {type: "OUT_EDGE", edge: e2}, weight: 3 / 16},
        ])
        .set(n3, [
          {adjacency: {type: "SYNTHETIC_LOOP"}, weight: 1 / 16},
          {adjacency: {type: "IN_EDGE", edge: e2}, weight: 6 / 10},
          {adjacency: {type: "IN_EDGE", edge: e3}, weight: 6 / 13},
          {adjacency: {type: "IN_EDGE", edge: e4}, weight: 6 / 16},
          {adjacency: {type: "OUT_EDGE", edge: e4}, weight: 3 / 16},
        ]);
      const canonicalize = (map) =>
        MapUtil.mapValues(map, (_, v) => sortBy(v, (x) => JSON.stringify(x)));
      expect(canonicalize(actual)).toEqual(canonicalize(expected));
    });
  });

  describe("createOrderedSparseMarkovChain", () => {
    it("works on a trivial one-node chain with no edge", () => {
      const n = NodeAddress.fromParts(["foo"]);
      const g = new Graph().addNode(n);
      const edgeWeight = (_unused_edge) => {
        throw new Error("Don't even look at me");
      };
      const osmc = createOrderedSparseMarkovChain(
        createConnections(createWeightedGraph(g, edgeWeight, 1e-3))
      );
      const expected = {
        nodeOrder: [n],
        chain: [
          {neighbor: new Uint32Array([0]), weight: new Float64Array([1.0])},
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });

    it("works on a simple asymmetric chain", () => {
      const n1 = NodeAddress.fromParts(["n1"]);
      const n2 = NodeAddress.fromParts(["n2"]);
      const n3 = NodeAddress.fromParts(["sink"]);
      const e1 = {src: n1, dst: n2, address: EdgeAddress.fromParts(["e1"])};
      const e2 = {src: n2, dst: n3, address: EdgeAddress.fromParts(["e2"])};
      const e3 = {src: n1, dst: n3, address: EdgeAddress.fromParts(["e3"])};
      const e4 = {src: n3, dst: n3, address: EdgeAddress.fromParts(["e4"])};
      const g = new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addEdge(e1)
        .addEdge(e2)
        .addEdge(e3)
        .addEdge(e4);
      const edgeWeight = () => ({toWeight: 1, froWeight: 0});
      const osmc = createOrderedSparseMarkovChain(
        createConnections(createWeightedGraph(g, edgeWeight, 0.0))
      );
      const expected = {
        nodeOrder: [n1, n2, n3],
        chain: [
          {
            neighbor: new Uint32Array([0, 1, 2]),
            weight: new Float64Array([0, 0, 0]),
          },
          {
            neighbor: new Uint32Array([0, 1, 2]),
            weight: new Float64Array([0.5, 0, 0]),
          },
          {
            neighbor: new Uint32Array([0, 1, 2]),
            weight: new Float64Array([0.5, 1.0, 1.0]),
          },
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });

    it("works on a symmetric K_3", () => {
      const n1 = NodeAddress.fromParts(["n1"]);
      const n2 = NodeAddress.fromParts(["n2"]);
      const n3 = NodeAddress.fromParts(["n3"]);
      const e1 = {src: n1, dst: n2, address: EdgeAddress.fromParts(["e1"])};
      const e2 = {src: n2, dst: n3, address: EdgeAddress.fromParts(["e2"])};
      const e3 = {src: n3, dst: n1, address: EdgeAddress.fromParts(["e3"])};
      const g = new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addEdge(e1)
        .addEdge(e2)
        .addEdge(e3);
      const edgeWeight = () => ({toWeight: 1, froWeight: 1});
      const osmc = createOrderedSparseMarkovChain(
        createConnections(createWeightedGraph(g, edgeWeight, 0.0))
      );
      const expected = {
        nodeOrder: [n1, n2, n3],
        chain: [
          {
            neighbor: new Uint32Array([0, 1, 2]),
            weight: new Float64Array([0, 0.5, 0.5]),
          },
          {
            neighbor: new Uint32Array([0, 1, 2]),
            weight: new Float64Array([0.5, 0, 0.5]),
          },
          {
            neighbor: new Uint32Array([0, 1, 2]),
            weight: new Float64Array([0.5, 0.5, 0]),
          },
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });

    it("works on the example graph", () => {
      const ag = advancedGraph();
      const g = ag.graph1();
      const epsilon = 0.5;
      function edgeWeight() {
        // These values are technically arbitrary, but make the
        // arithmetic simple.
        return {toWeight: 4 - epsilon / 2, froWeight: 1 - epsilon / 2};
      }
      const osmc = createOrderedSparseMarkovChain(
        createConnections(createWeightedGraph(g, edgeWeight, epsilon))
      );
      // Edges from `src`:
      //   - to `src` with weight `epsilon`
      //   - to `dst` with weight `4 - epsilon / 2`
      //   - to `dst` with weight `4 - epsilon / 2`
      // Total out-weight: `8`.
      //
      // Edges from `dst`:
      //   - to `src` with weight `1 - epsilon / 2`
      //   - to `src` with weight `1 - epsilon / 2`
      //   - to `dst` with weight `epsilon`
      // Total out-weight: `2`.
      //
      // Normalized in-weights:
      //   - src: `epsilon / 8` from src, `(2 - epsilon) / 2` from dst
      //   - dst: `epsilon / 2` from dst, `(8 - epsilon) / 8` from src
      const expected = {
        nodeOrder: [
          ag.nodes.src(),
          ag.nodes.dst(),
          ag.nodes.loop(),
          ag.nodes.isolated(),
        ],
        chain: [
          {
            neighbor: new Uint32Array([0, 1]),
            weight: new Float64Array([epsilon / 8, (2 - epsilon) / 2]),
          },
          {
            neighbor: new Uint32Array([0, 1]),
            weight: new Float64Array([(8 - epsilon) / 8, epsilon / 2]),
          },
          {neighbor: new Uint32Array([2]), weight: new Float64Array([1])},
          {neighbor: new Uint32Array([3]), weight: new Float64Array([1])},
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });
  });

  describe("distributionToNodeDistribution", () => {
    it("works", () => {
      const pi = new Float64Array([0.25, 0.75]);
      const n1 = NodeAddress.fromParts(["foo"]);
      const n2 = NodeAddress.fromParts(["bar"]);
      expect(distributionToNodeDistribution([n1, n2], pi)).toEqual(
        new Map().set(n1, 0.25).set(n2, 0.75)
      );
    });
  });
});
