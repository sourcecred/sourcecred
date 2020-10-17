// @flow

import deepFreeze from "deep-freeze";
import * as NullUtil from "../../util/null";
import {Graph} from "../graph";
import {MarkovProcessGraph} from "./markovProcessGraph";
import {
  markovEdgeAddress,
  MarkovEdgeAddress,
  markovEdgeAddressFromMarkovEdge,
  type MarkovEdge,
} from "./markovEdge";
import {NodeAddress as NA, EdgeAddress as EA} from "../graph";
import * as uuid from "../../util/uuid"; // for spy purposes
import {intervalSequence} from "../interval";

import {seedGadget, accumulatorGadget, epochGadget} from "./nodeGadgets";
import {
  radiationGadget,
  seedMintGadget,
  payoutGadget,
  forwardWebbingGadget,
  backwardWebbingGadget,
} from "./edgeGadgets";

describe("core/credrank/markovProcessGraph", () => {
  const na = (name) => NA.fromParts([name]);
  const ea = (name) => EA.fromParts([name]);

  const participantNode1 = {
    description: "participant1",
    address: na("participant1"),
    timestampMs: null,
  };
  const id1 = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
  const participant1 = {
    description: participantNode1.description,
    address: participantNode1.address,
    id: id1,
  };

  const participantNode2 = {
    description: "participant2",
    address: na("participant2"),
    timestampMs: null,
  };
  const id2 = uuid.fromString("YVZhbGlkVXVpZE20TGFzdA");
  const participant2 = {
    description: participantNode2.description,
    address: participantNode2.address,
    id: id2,
  };

  const interval0 = {startTimeMs: 0, endTimeMs: 2};
  const interval1 = {startTimeMs: 2, endTimeMs: 4};
  const intervals = deepFreeze(intervalSequence([interval0, interval1]));

  const c0 = {description: "c0", address: na("c0"), timestampMs: 0};
  const c1 = {description: "c1", address: na("c1"), timestampMs: 2};

  const e0 = {
    address: ea("e0"),
    src: c0.address,
    dst: participantNode1.address,
    timestampMs: 1,
  };
  const e1 = {
    address: ea("e1"),
    src: c1.address,
    dst: participantNode1.address,
    timestampMs: 3,
  };
  const e2 = {
    address: ea("e2"),
    src: c0.address,
    dst: c1.address,
    timestampMs: 4,
  };
  const e3 = {
    address: ea("e3"),
    src: c0.address,
    dst: c1.address,
    timestampMs: 4,
  };

  deepFreeze([participant1, participant2, c0, c1, e0, e1]);

  const parameters = deepFreeze({
    beta: 0.2,
    gammaForward: 0.15,
    gammaBackward: 0.1,
    alpha: 0.2,
  });

  const graph = () =>
    new Graph()
      .addNode(participantNode1)
      .addNode(participantNode2)
      .addNode(c0)
      .addNode(c1)
      .addEdge(e0)
      .addEdge(e1)
      .addEdge(e2)
      .addEdge(e3);
  const nodeWeights = () => new Map().set(c0.address, 1).set(c1.address, 2);
  const edgeWeights = () =>
    new Map()
      .set(e0.address, {forwards: 1, backwards: 0})
      .set(e1.address, {forwards: 2, backwards: 1})
      .set(e3.address, {forwards: 0, backwards: 0});
  const weights = () => ({
    nodeWeights: nodeWeights(),
    edgeWeights: edgeWeights(),
  });
  const weightedGraph = () => ({weights: weights(), graph: graph()});
  const args = () => ({
    weightedGraph: weightedGraph(),
    parameters,
    intervals,
    participants: [participant1, participant2],
  });
  const markovProcessGraph = () => MarkovProcessGraph.new(args());

  function checkMarkovEdge(mpg: MarkovProcessGraph, me: MarkovEdge) {
    const addr = markovEdgeAddressFromMarkovEdge(me);
    const actual = mpg.edge(addr);
    if (actual == null) {
      throw new Error(
        `no markov edge matching ${MarkovEdgeAddress.toString(addr)}`
      );
    }
    expect({...me, transitionProbability: expect.anything()}).toEqual(actual);
    expect(me.transitionProbability).toBeCloseTo(actual.transitionProbability);
  }

  describe("basic validation", () => {
    it("errors for negative parameters", () => {
      const badParameters = [
        {alpha: -0.1, beta: 0.1, gammaForward: 0.1, gammaBackward: 0.1},
        {alpha: 0.1, beta: -0.1, gammaForward: 0.1, gammaBackward: 0.1},
        {alpha: 0.1, beta: 0.1, gammaForward: -0.1, gammaBackward: 0.1},
        {alpha: 0.1, beta: 0.1, gammaForward: 0.1, gammaBackward: -0.1},
      ];
      for (const b of badParameters) {
        const badArgs = {...args(), parameters: b};
        const thunk = () => MarkovProcessGraph.new(badArgs);
        expect(thunk).toThrowError("Invalid transition probability");
      }
    });
    it("errors if parameters sum greater than 1", () => {
      const bad = {
        alpha: 0.25,
        gammaForward: 0.25,
        gammaBackward: 0.3,
        beta: 0.25,
      };
      const thunk = () => MarkovProcessGraph.new({...args(), parameters: bad});
      expect(thunk).toThrowError("Overlarge transition probability");
    });
  });

  describe("organic nodes / edges", () => {
    it("each contribution is present with the correct weight", () => {
      const mpg = markovProcessGraph();
      const n0 = NullUtil.get(mpg.node(c0.address));
      expect(n0.mint).toEqual(nodeWeights().get(n0.address));
      const n1 = NullUtil.get(mpg.node(c1.address));
      expect(n1.mint).toEqual(nodeWeights().get(n1.address));
    });
    it("the participant is not present", () => {
      const mpg = markovProcessGraph();
      expect(mpg.node(participant1.address)).toEqual(null);
    });
    it("the edge between contributions corresponds to two MarkovEdges", () => {
      const mpg = markovProcessGraph();
      const aF = markovEdgeAddress(e2.address, "F");
      const aB = markovEdgeAddress(e2.address, "B");
      const eF = NullUtil.get(mpg.edge(aF));
      const eB = NullUtil.get(mpg.edge(aB));
      expect(eF).toEqual({
        address: e2.address,
        reversed: false,
        src: e2.src,
        dst: e2.dst,
        transitionProbability: (1 / 2) * (1 - parameters.alpha),
      });
      expect(eB).toEqual({
        address: e2.address,
        reversed: true,
        src: e2.dst,
        dst: e2.src,
        transitionProbability: (1 / 3) * (1 - parameters.alpha),
      });
    });

    it("an edge with weights of 0 will not appear in the graph whatsoever", () => {
      const mpg = markovProcessGraph();
      expect(edgeWeights().get(e3.address)).toEqual({
        forwards: 0,
        backwards: 0,
      });
      const f = markovEdgeAddress(e3.address, "F");
      const b = markovEdgeAddress(e3.address, "B");
      expect(mpg.edge(f)).toEqual(null);
      expect(mpg.edge(b)).toEqual(null);
    });
  });

  describe("gadgets", () => {
    describe("seed", () => {
      it("has a seed node", () => {
        const mpg = markovProcessGraph();
        expect(mpg.node(seedGadget.prefix)).toEqual(seedGadget.node());
      });
      it("the seed has outbound edges to contributions in proportion to their mint amount", () => {
        const mpg = markovProcessGraph();
        const m0 = seedMintGadget.markovEdge(c0.address, 1 / 3);
        checkMarkovEdge(mpg, m0);
        const m1 = seedMintGadget.markovEdge(c1.address, 2 / 3);
        checkMarkovEdge(mpg, m1);
      });
      it("seed node has a radiation-in edge for each organic contribution with pr === alpha", () => {
        const mpg = markovProcessGraph();
        const organicNodes = [c0, c1];
        for (const {address} of organicNodes) {
          const edge = radiationGadget.markovEdge(address, parameters.alpha);
          checkMarkovEdge(mpg, edge);
        }
      });
    });

    it("creates participant epoch nodes", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        const address = {
          owner: participant1.id,
          epochStart: boundary,
        };
        const node = epochGadget.node(address);
        expect(mpg.node(node.address)).toEqual(node);
      }
    });

    it("participant epoch nodes have radiation edges out", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        const structuredAddress = {
          owner: participant1.id,
          epochStart: boundary,
        };

        const radiationTransitionProbability = NullUtil.get(
          new Map()
            // .65 -- because this one has no incident organic edges, and no backwards webbing
            .set(-Infinity, 1 - parameters.gammaForward - parameters.beta)
            // .55 -- because this one has no incident organic edges
            .set(
              0,
              1 -
                parameters.gammaForward -
                parameters.gammaBackward -
                parameters.beta
            )
            // .2 -- because this has incident organic edges
            .set(2, parameters.alpha)
            // 0.7 -- because this has no incident organic edges, and no forward webbing
            .set(Infinity, 1 - parameters.gammaBackward - parameters.beta)
            .get(boundary)
        );
        const radiationEdgeExpected = radiationGadget.markovEdge(
          epochGadget.toRaw(structuredAddress),
          radiationTransitionProbability
        );
        checkMarkovEdge(mpg, radiationEdgeExpected);
      }
    });

    it("user epoch nodes have payout edges to the accumulator", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        const structuredAddress = {
          owner: participant1.id,
          epochStart: boundary,
        };
        // Find the "payout" edge, directed to the correct epoch accumulator
        const payoutEdge = payoutGadget.markovEdge(
          structuredAddress,
          parameters.beta
        );
        checkMarkovEdge(mpg, payoutEdge);
      }
    });

    it("user epoch nodes have temporal webbing", () => {
      const mpg = markovProcessGraph();
      for (const participant of [participant1, participant2]) {
        let lastBoundary = null;
        for (const boundary of mpg.epochBoundaries()) {
          const epochAddress = {
            owner: participant.id,
            epochStart: boundary,
          };
          // Find the epoch node
          const epochNode = epochGadget.node(epochAddress);
          expect(mpg.node(epochNode.address)).toEqual(epochNode);

          if (lastBoundary != null) {
            // Find the forward and backwards webbing edges
            const webbingAddress = {
              lastStart: lastBoundary,
              thisStart: boundary,
              owner: participant.id,
            };
            const forwardWebbing = forwardWebbingGadget.markovEdge(
              webbingAddress,
              parameters.gammaForward
            );
            checkMarkovEdge(mpg, forwardWebbing);
            const backwardWebbing = backwardWebbingGadget.markovEdge(
              webbingAddress,
              parameters.gammaBackward
            );
            checkMarkovEdge(mpg, backwardWebbing);
          }
          lastBoundary = boundary;
        }
      }
    });

    it("sets up epoch accumulator nodes, with radiation to seed", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        // There's an epoch accumulator node
        const accumulatorAddress = {
          epochStart: boundary,
        };
        expect(mpg.node(accumulatorGadget.toRaw(accumulatorAddress))).toEqual(
          accumulatorGadget.node(accumulatorAddress)
        );
        const radiationEdge = radiationGadget.markovEdge(
          accumulatorGadget.toRaw(accumulatorAddress),
          1
        );
        checkMarkovEdge(mpg, radiationEdge);
      }
    });

    it("re-writes edges incident to the participants so that they touch the participant epoch node", () => {
      const mpg = markovProcessGraph();
      const epoch0 = epochGadget.toRaw({
        owner: participant1.id,
        epochStart: 0,
      });
      const epoch2 = epochGadget.toRaw({
        owner: participant1.id,
        epochStart: 2,
      });
      const e0F = {
        address: e0.address,
        reversed: false,
        src: e0.src,
        dst: epoch0,
        transitionProbability: (1 / 2) * (1 - parameters.alpha),
      };
      checkMarkovEdge(mpg, e0F);
      const e0BAddr = markovEdgeAddress(e0.address, "B");
      // It has 0 backwards transition probability, so it is elided
      expect(mpg.edge(e0BAddr)).toEqual(null);
      const e1F = {
        address: e1.address,
        reversed: false,
        src: e1.src,
        dst: epoch2,
        transitionProbability: (2 / 3) * (1 - parameters.alpha),
      };
      checkMarkovEdge(mpg, e1F);
      const e1B = {
        address: e1.address,
        reversed: true,
        src: epoch2,
        dst: e1.src,
        transitionProbability:
          1 -
          parameters.alpha -
          parameters.beta -
          parameters.gammaForward -
          parameters.gammaBackward,
      };
      checkMarkovEdge(mpg, e1B);
    });
  });

  describe("toMarkovChain", () => {
    it("does not violate its own invariant checker", () => {
      markovProcessGraph().toMarkovChain();
    });
  });

  describe("accessors", () => {
    it("nodes() yields nodes in nodeOrder", () => {
      const mpg = markovProcessGraph();
      const nodeOrder = [...mpg.nodeOrder()];
      const nodesActual = [...mpg.nodes()];
      const nodesExpected = nodeOrder.map((x) => mpg.node(x));
      expect(nodesActual).toEqual(nodesExpected);
    });
    it("edges() yields edges in edgeOrder", () => {
      const mpg = markovProcessGraph();
      const edgeOrder = [...mpg.edgeOrder()];
      const edgesActual = [...mpg.edges()];
      const edgesExpected = edgeOrder.map((x) => mpg.edge(x));
      expect(edgesActual).toEqual(edgesExpected);
    });
    it("nodeIndex is consonant with nodeOrder", () => {
      const mpg = markovProcessGraph();
      const nodeOrder = [...mpg.nodeOrder()];
      nodeOrder.forEach((n, i) => {
        expect(mpg.nodeIndex(n)).toEqual(i);
      });
    });
    it("edgeIndex is consonant with edgeOrder", () => {
      const mpg = markovProcessGraph();
      const edgeOrder = [...mpg.edgeOrder()];
      edgeOrder.forEach((n, i) => {
        expect(mpg.edgeIndex(n)).toEqual(i);
      });
    });
    it("has the correct epoch boundaries for the given intervals", () => {
      const expected = [-Infinity, 0, 2, Infinity];
      expect(markovProcessGraph().epochBoundaries()).toEqual(expected);
    });
    it("has the right participants", () => {
      expect(markovProcessGraph().participants()).toEqual([
        participant1,
        participant2,
      ]);
    });
    it("has the right parameters", () => {
      expect(markovProcessGraph().parameters()).toEqual(parameters);
    });
  });

  describe("to/froJSON", () => {
    it("has round trip equality", () => {
      const mpg = markovProcessGraph();
      const mpgJson = mpg.toJSON();
      const mpg_ = MarkovProcessGraph.fromJSON(mpgJson);
      const mpgJson_ = mpg_.toJSON();
      expect(mpg).toEqual(mpg_);
      expect(mpgJson).toEqual(mpgJson_);
    });
    it("serialization does not change node/edge iteration order", () => {
      const mpg1 = markovProcessGraph();
      const mpg2 = MarkovProcessGraph.fromJSON(mpg1.toJSON());
      expect([...mpg1.nodeOrder()]).toEqual([...mpg2.nodeOrder()]);
      expect([...mpg1.edgeOrder()]).toEqual([...mpg2.edgeOrder()]);
      expect([...mpg1.nodes()]).toEqual([...mpg2.nodes()]);
      expect([...mpg1.edges()]).toEqual([...mpg2.edges()]);
    });
  });
});
