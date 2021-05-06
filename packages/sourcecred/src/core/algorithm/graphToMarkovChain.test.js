// @flow

import sortBy from "../../util/sortBy";

import {Graph, EdgeAddress} from "../graph";
import {
  createConnections,
  createOrderedSparseMarkovChain,
  normalize,
  normalizeNeighbors,
  permute,
} from "./graphToMarkovChain";
import * as MapUtil from "../../util/map";

import {node, advancedGraph, edge} from "../graphTestUtil";

describe("core/algorithm/graphToMarkovChain", () => {
  const n1 = node("n1");
  const n2 = node("n2");
  const n3 = node("n3");
  describe("permute", () => {
    // This chain isn't a proper stochastic chain, but that's okay:
    // the actual values aren't relevant.
    const old = {
      nodeOrder: [n1.address, n2.address, n3.address],
      chain: [
        {
          neighbor: new Uint32Array([0, 1]),
          weight: new Float64Array([0.2, 0.8]),
        },
        {neighbor: new Uint32Array([2]), weight: new Float64Array([0.9])},
        {neighbor: new Uint32Array([]), weight: new Float64Array([])},
      ],
    };
    const newOrder = [n2.address, n3.address, n1.address];
    const actual = permute(old, newOrder);
    const expected = {
      nodeOrder: [n2.address, n3.address, n1.address],
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
      nodeOrder: [n2.address, n3.address, n1.address],
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
      nodeOrder: [n2.address, n3.address, n1.address],
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
      const edgeWeight = () => ({forwards: 6.0, backwards: 3.0});
      const actual = createConnections(g, edgeWeight, 1.0);
      // Total out-weights (for normalization factors):
      //   - for `n1`: 2 out, 0 in, 1 synthetic: 12 + 0 + 1 = 13
      //   - for `n2`: 1 out, 1 in, 1 synthetic: 6 + 3 + 1 = 10
      //   - for `n3`: 1 out, 3 in, 1 synthetic: 6 + 9 + 1 = 16
      const expected = new Map()
        .set(n1.address, [
          {adjacency: {type: "SYNTHETIC_LOOP"}, weight: 1 / 13},
          {adjacency: {type: "OUT_EDGE", edge: e1}, weight: 3 / 10},
          {adjacency: {type: "OUT_EDGE", edge: e3}, weight: 3 / 16},
        ])
        .set(n2.address, [
          {adjacency: {type: "SYNTHETIC_LOOP"}, weight: 1 / 10},
          {adjacency: {type: "IN_EDGE", edge: e1}, weight: 6 / 13},
          {adjacency: {type: "OUT_EDGE", edge: e2}, weight: 3 / 16},
        ])
        .set(n3.address, [
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
        nodeOrder: [n1.address],
        chain: [
          {neighbor: new Uint32Array([0]), weight: new Float64Array([1.0])},
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });

    it("ignores dangling edges", () => {
      const e1 = {
        src: n1.address,
        dst: n2.address,
        address: EdgeAddress.fromParts(["e1"]),
        timestampMs: 0,
      };
      const g = new Graph().addNode(n1).addEdge(e1);
      const edgeWeight = (_unused_edge) => {
        throw new Error("Don't even look at me");
      };
      const osmc = createOrderedSparseMarkovChain(
        createConnections(g, edgeWeight, 1e-3)
      );
      const expected = {
        nodeOrder: [n1.address],
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
      const edgeWeight = () => ({forwards: 1, backwards: 0});
      const osmc = createOrderedSparseMarkovChain(
        createConnections(g, edgeWeight, 0.0)
      );
      const expected = {
        nodeOrder: [n1.address, n2.address, n3.address],
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
      const edgeWeight = () => ({forwards: 1, backwards: 1});
      const osmc = createOrderedSparseMarkovChain(
        createConnections(g, edgeWeight, 0.0)
      );
      const expected = {
        nodeOrder: [n1.address, n2.address, n3.address],
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
        return {forwards: 4 - epsilon / 2, backwards: 1 - epsilon / 2};
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
          ag.nodes.src.address,
          ag.nodes.dst.address,
          ag.nodes.loop.address,
          ag.nodes.isolated.address,
          ag.nodes.halfIsolated.address,
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
          {neighbor: new Uint32Array([4]), weight: new Float64Array([1])},
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });
  });

  describe("graph -> OrderedSparseMarkovChain", () => {
    it("always uses the graph canoncial ordering", () => {
      const ag = advancedGraph();
      const g1 = ag.graph1();
      const g2 = ag.graph2();
      function graphToOrder(g) {
        const connections = createConnections(
          g,
          (_) => ({forwards: 1, backwards: 1}),
          0.01
        );
        const osmc = createOrderedSparseMarkovChain(connections);
        return osmc.nodeOrder;
      }
      const o1 = graphToOrder(g1);
      const o2 = graphToOrder(g2);
      const expected = Array.from(g1.nodes()).map((x) => x.address);
      expect(o1).toEqual(expected);
      expect(o2).toEqual(expected);
    });
  });
});
