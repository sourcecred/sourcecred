// @flow

import deepFreeze from "deep-freeze";
import * as NullUtil from "../util/null";
import {Graph} from "./graph";
import {
  MarkovProcessGraph,
  markovEdgeAddress,
  MarkovEdgeAddress,
  markovEdgeAddressFromMarkovEdge,
  type MarkovEdge,
} from "./markovProcessGraph";
import * as MPG from "./markovProcessGraph";
import {NodeAddress as NA, EdgeAddress as EA} from "./graph";
import * as uuid from "../util/uuid"; // for spy purposes
import {intervalSequence} from "./interval";

describe("core/markovProcessGraph", () => {
  const na = (name) => NA.fromParts([name]);
  const ea = (name) => EA.fromParts([name]);

  const participantNode = {
    description: "participant",
    address: na("participant"),
    timestampMs: null,
  };
  const id1 = uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA");
  const participant = {
    description: participantNode.description,
    address: participantNode.address,
    id: id1,
  };

  const interval0 = {startTimeMs: 0, endTimeMs: 2};
  const interval1 = {startTimeMs: 2, endTimeMs: 4};
  const intervals = deepFreeze(intervalSequence([interval0, interval1]));

  const c0 = {description: "c0", address: na("c0"), timestampMs: 0};
  const c1 = {description: "c1", address: na("c1"), timestampMs: 2};

  const e0 = {
    address: ea("e0"),
    src: c0.address,
    dst: participantNode.address,
    timestampMs: 1,
  };
  const e1 = {
    address: ea("e1"),
    src: c1.address,
    dst: participantNode.address,
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

  deepFreeze([participant, c0, c1, e0, e1]);

  const parameters = deepFreeze({
    beta: 0.2,
    gammaForward: 0.15,
    gammaBackward: 0.1,
    alpha: 0.2,
  });

  const graph = () =>
    new Graph()
      .addNode(participantNode)
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
    participants: [participant],
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
      expect(mpg.node(participant.address)).toEqual(null);
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

  it("has the correct epoch boundaries for the given intervals", () => {
    const expected = [-Infinity, 0, 2, Infinity];
    expect(markovProcessGraph().epochBoundaries()).toEqual(expected);
  });

  describe("gadgets", () => {
    describe("seed", () => {
      it("has a seed node", () => {
        const mpg = markovProcessGraph();
        expect(mpg.node(MPG.SEED_ADDRESS)).toEqual({
          mint: 0,
          description: MPG.SEED_DESCRIPTION,
          address: MPG.SEED_ADDRESS,
        });
      });
      it("the seed has outbound edges to contributions in proportion to their mint amount", () => {
        const mpg = markovProcessGraph();
        const m0 = {
          address: EA.append(MPG.SEED_MINT, ...NA.toParts(c0.address)),
          reversed: false,
          src: MPG.SEED_ADDRESS,
          dst: c0.address,
          transitionProbability: 1 / 3,
        };
        checkMarkovEdge(mpg, m0);
        const m1 = {
          address: EA.append(MPG.SEED_MINT, ...NA.toParts(c1.address)),
          reversed: false,
          src: MPG.SEED_ADDRESS,
          dst: c1.address,
          transitionProbability: 2 / 3,
        };
        checkMarkovEdge(mpg, m1);
      });
      it("seed node has a radiation-in edge for each organic contribution with pr === alpha", () => {
        const mpg = markovProcessGraph();
        const organicNodes = [c0, c1];
        for (const organic of organicNodes) {
          const address = EA.append(
            MPG.CONTRIBUTION_RADIATION,
            ...NA.toParts(organic.address)
          );
          const expectedMarkovEdge = {
            address,
            reversed: false,
            src: organic.address,
            dst: MPG.SEED_ADDRESS,
            transitionProbability: parameters.alpha,
          };
          checkMarkovEdge(mpg, expectedMarkovEdge);
        }
      });
    });

    it("creates user epoch nodes", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        const structuredAddress = {
          type: "USER_EPOCH",
          owner: participant.address,
          epochStart: boundary,
        };
        const epochAddress = MPG.userEpochNodeAddressToRaw(structuredAddress);
        // Find the node
        expect(mpg.node(epochAddress)).toEqual({
          description: `Epoch starting ${boundary} ms past epoch`,
          mint: 0,
          address: epochAddress,
        });
      }
    });

    it("user epoch nodes have radiation edges out", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        const structuredAddress = {
          type: "USER_EPOCH",
          owner: participant.address,
          epochStart: boundary,
        };
        const epochAddress = MPG.userEpochNodeAddressToRaw(structuredAddress);

        // Find the radiation edge
        const radiationAddress = EA.append(
          MPG.USER_EPOCH_RADIATION,
          ...NA.toParts(epochAddress)
        );
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
        const radiationEdgeExpected = {
          address: radiationAddress,
          reversed: false,
          src: epochAddress,
          dst: MPG.SEED_ADDRESS,
          transitionProbability: radiationTransitionProbability,
        };
        checkMarkovEdge(mpg, radiationEdgeExpected);
      }
    });

    it("user epoch nodes have payout edges to the accumulator", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        const structuredAddress = {
          type: "USER_EPOCH",
          owner: participant.address,
          epochStart: boundary,
        };
        const epochAddress = MPG.userEpochNodeAddressToRaw(structuredAddress);
        const accumulatorAddress = MPG.epochAccumulatorAddressToRaw({
          type: "EPOCH_ACCUMULATOR",
          epochStart: boundary,
        });
        // Find the "payout" edge, directed to the correct epoch accumulator
        const payoutAddress = MPG.payoutAddressForEpoch(structuredAddress);
        const payoutEdge = {
          address: payoutAddress,
          reversed: false,
          src: epochAddress,
          dst: accumulatorAddress,
          transitionProbability: parameters.beta,
        };
        checkMarkovEdge(mpg, payoutEdge);
      }
    });

    it("user epoch nodes have temporal webbing", () => {
      const mpg = markovProcessGraph();
      let lastEpochNodeAddress = null;
      for (const boundary of mpg.epochBoundaries()) {
        const structuredAddress = {
          type: "USER_EPOCH",
          owner: participant.address,
          epochStart: boundary,
        };
        const epochAddress = MPG.userEpochNodeAddressToRaw(structuredAddress);
        // Find the node
        expect(mpg.node(epochAddress)).toEqual({
          description: `Epoch starting ${boundary} ms past epoch`,
          mint: 0,
          address: epochAddress,
        });
        // Find the webbing addresses
        if (lastEpochNodeAddress != null) {
          const webAddress = EA.append(
            MPG.EPOCH_WEBBING,
            String(boundary),
            ...NA.toParts(participant.address)
          );
          const webF = {
            address: webAddress,
            reversed: false,
            src: lastEpochNodeAddress,
            dst: epochAddress,
            transitionProbability: parameters.gammaForward,
          };
          checkMarkovEdge(mpg, webF);
          const webB = {
            address: webAddress,
            reversed: true,
            src: epochAddress,
            dst: lastEpochNodeAddress,
            transitionProbability: parameters.gammaBackward,
          };
          checkMarkovEdge(mpg, webB);
        }
        lastEpochNodeAddress = epochAddress;
      }
    });

    it("sets up epoch accumulator nodes, with radiation to seed", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochBoundaries()) {
        // There's an epoch accumulator node
        const accumulatorAddress = MPG.epochAccumulatorAddressToRaw({
          type: "EPOCH_ACCUMULATOR",
          epochStart: boundary,
        });
        expect(mpg.node(accumulatorAddress)).toEqual({
          address: accumulatorAddress,
          description: `Epoch accumulator starting ${boundary} ms past epoch`,
          mint: 0,
        });

        const radiationAddress = EA.append(
          MPG.EPOCH_ACCUMULATOR_RADIATION,
          ...NA.toParts(accumulatorAddress)
        );
        const radiationEdge = {
          address: radiationAddress,
          reversed: false,
          src: accumulatorAddress,
          dst: MPG.SEED_ADDRESS,
          transitionProbability: 1,
        };
        checkMarkovEdge(mpg, radiationEdge);
      }
    });

    it("re-writes edges incident to the participants so that they touch the participant epoch node", () => {
      const mpg = markovProcessGraph();
      const epoch0 = MPG.userEpochNodeAddressToRaw({
        type: "USER_EPOCH",
        owner: participant.address,
        epochStart: 0,
      });
      const epoch2 = MPG.userEpochNodeAddressToRaw({
        type: "USER_EPOCH",
        owner: participant.address,
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
});
