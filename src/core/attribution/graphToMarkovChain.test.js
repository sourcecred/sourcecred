// @flow

import sortBy from "lodash.sortby";

import {Graph, NodeAddress} from "../graph";
import {
  createConnections,
  createOrderedSparseMarkovChain,
  normalize,
  normalizeNeighbors,
  permute,
} from "./graphToMarkovChain";
import {
  distributionToNodeDistribution,
  weightedDistribution,
} from "./nodeDistribution";
import * as MapUtil from "../../util/map";

import {node, advancedGraph, edge} from "../graphTestUtil";

describe("core/attribution/graphToMarkovChain", () => {
  const n1 = node("n1");
  const n2 = node("n2");
  const n3 = node("n3");
  describe("permute", () => {
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

  describe("createConnections", () => {
    // The tests for `createOrderedSparseMarkovChain` also must invoke
    // `createConnections`, so we add only light testing separately.
    it("works on a simple asymmetric chain", () => {
      const e1 = edge("e1", n1, n2);
      const e2 = edge("e2", n2, n3);
      const e3 = edge("e3", n1, n3);
      const e4 = edge("e4", n3, n3);

      const g = new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addEdge(e1)
        .addEdge(e2)
        .addEdge(e3)
        .addEdge(e4);
      const edgeWeight = () => ({toWeight: 6.0, froWeight: 3.0});
      const actual = createConnections(g, edgeWeight, 1.0);
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
      const g = new Graph().addNode(n1);
      const edgeWeight = (_unused_edge) => {
        throw new Error("Don't even look at me");
      };
      const osmc = createOrderedSparseMarkovChain(
        createConnections(g, edgeWeight, 1e-3)
      );
      const expected = {
        nodeOrder: [n1],
        chain: [
          {neighbor: new Uint32Array([0]), weight: new Float64Array([1.0])},
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });

    it("works on a simple asymmetric chain", () => {
      const e1 = edge("e1", n1, n2);
      const e2 = edge("e2", n2, n3);
      const e3 = edge("e3", n1, n3);
      const e4 = edge("e4", n3, n3);

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
        createConnections(g, edgeWeight, 0.0)
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
      const e1 = edge("e1", n1, n2);
      const e2 = edge("e2", n2, n3);
      const e3 = edge("e3", n3, n1);
      const g = new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addEdge(e1)
        .addEdge(e2)
        .addEdge(e3);
      const edgeWeight = () => ({toWeight: 1, froWeight: 1});
      const osmc = createOrderedSparseMarkovChain(
        createConnections(g, edgeWeight, 0.0)
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
        createConnections(g, edgeWeight, epsilon)
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
          ag.nodes.src,
          ag.nodes.dst,
          ag.nodes.loop,
          ag.nodes.isolated,
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
      expect(distributionToNodeDistribution([n1, n2], pi)).toEqual(
        new Map().set(n1, 0.25).set(n2, 0.75)
      );
    });
  });

  describe("weightedDistribution", () => {
    const a = NodeAddress.fromParts(["a"]);
    const b = NodeAddress.fromParts(["b"]);
    const c = NodeAddress.fromParts(["c"]);
    const d = NodeAddress.fromParts(["d"]);
    const order = () => [a, b, c, d];
    it("gives a uniform distribution for an empty map", () => {
      expect(weightedDistribution(order(), new Map())).toEqual(
        new Float64Array([0.25, 0.25, 0.25, 0.25])
      );
    });
    it("gives a uniform distribution for a map with 0 weight", () => {
      const map = new Map().set(a, 0);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0.25, 0.25, 0.25, 0.25])
      );
    });
    it("can put all weight on one node", () => {
      const map = new Map().set(b, 0.1);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0, 1, 0, 0])
      );
    });
    it("can split weight unequally", () => {
      const map = new Map().set(b, 1).set(c, 3);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0, 0.25, 0.75, 0])
      );
    });
    it("can create a uniform distribution if all weights are equal", () => {
      const map = new Map()
        .set(a, 1)
        .set(b, 1)
        .set(c, 1)
        .set(d, 1);
      expect(weightedDistribution(order(), map)).toEqual(
        new Float64Array([0.25, 0.25, 0.25, 0.25])
      );
    });
    describe("errors if", () => {
      it("has a weighted node that is not in the order", () => {
        const z = NodeAddress.fromParts(["z"]);
        const map = new Map().set(z, 1);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "weights included nodes not present in the nodeOrder"
        );
      });
      it("has a node with negative weight", () => {
        const map = new Map().set(a, -1);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "Invalid weight -1"
        );
      });
      it("has a node with NaN weight", () => {
        const map = new Map().set(a, NaN);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "Invalid weight NaN"
        );
      });
      it("has a node with infinite weight", () => {
        const map = new Map().set(a, Infinity);
        expect(() => weightedDistribution(order(), map)).toThrowError(
          "Invalid weight Infinity"
        );
      });
    });
  });
});
