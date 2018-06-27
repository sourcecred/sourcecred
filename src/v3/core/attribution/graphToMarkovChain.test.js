// @flow

import {EdgeAddress, Graph, NodeAddress} from "../graph";
import {
  distributionToPagerankResult,
  graphToOrderedSparseMarkovChain,
  normalize,
  normalizeNeighbors,
  permute,
} from "./graphToMarkovChain";

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

  describe("graphToOrderedSparseMarkovChain", () => {
    it("works on a trivial one-node chain with no edge", () => {
      const n = NodeAddress.fromParts(["foo"]);
      const g = new Graph().addNode(n);
      const edgeWeight = (_unused_edge) => {
        throw new Error("Don't even look at me");
      };
      const osmc = graphToOrderedSparseMarkovChain(g, edgeWeight, 1e-3);
      const expected = {
        nodeOrder: [n],
        chain: [
          {neighbor: new Uint32Array([0]), weight: new Float64Array([1.0])},
        ],
      };
      expect(normalize(osmc)).toEqual(normalize(expected));
    });

    it("works on a simple asymmetric two-node chain", () => {
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
      const osmc = graphToOrderedSparseMarkovChain(g, edgeWeight, 0.0);
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
      const osmc = graphToOrderedSparseMarkovChain(g, edgeWeight, 0.0);
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
      const osmc = graphToOrderedSparseMarkovChain(g, edgeWeight, epsilon);
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

  describe("distributionToPagerankResult", () => {
    it("works", () => {
      const pi = new Float64Array([0.25, 0.75]);
      const n1 = NodeAddress.fromParts(["foo"]);
      const n2 = NodeAddress.fromParts(["bar"]);
      expect(distributionToPagerankResult([n1, n2], pi)).toEqual(
        new Map().set(n1, 0.25).set(n2, 0.75)
      );
    });
  });
});
