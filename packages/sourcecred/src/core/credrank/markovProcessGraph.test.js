// @flow

import {sum} from "d3-array";
import * as NullUtil from "../../util/null";
import * as GraphUtil from "./testUtils";
import {
  MarkovProcessGraph,
  parser as markovProcessGraphParser,
} from "./markovProcessGraph";
import {
  markovEdgeAddress,
  MarkovEdgeAddress,
  markovEdgeAddressFromMarkovEdge,
  type MarkovEdge,
} from "./markovEdge";
import {seedGadget, accumulatorGadget, epochGadget} from "./nodeGadgets";
import {
  radiationGadget,
  seedMintGadget,
  payoutGadget,
  forwardWebbingGadget,
  backwardWebbingGadget,
  personalAttributionGadget,
} from "./edgeGadgets";
import {intervalSequence} from "../interval";

import {
  args,
  markovProcessGraph,
  contributions,
  e0,
  e1,
  e2,
  e3,
  nodeWeight,
  edgeWeight,
  participant1,
  parameters,
  participants,
  attributions,
  intervals,
} from "./testUtils";

describe("core/credrank/markovProcessGraph", () => {
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
    it("errors if there are no intervals", () => {
      const badArgs = {...args(), intervals: intervalSequence([])};
      const thunk = () => MarkovProcessGraph.new(badArgs);
      expect(thunk).toThrowError("need at least one interval");
    });
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
      for (const contrib of contributions) {
        const node = NullUtil.get(mpg.node(contrib.address));
        const mint = node.mint;
        const expectedMint = nodeWeight(contrib.address);
        expect(mint).toEqual(expectedMint);
      }
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
      const addr = e3.address;
      expect(edgeWeight(addr)).toEqual({
        forwards: 0,
        backwards: 0,
      });
      const f = markovEdgeAddress(addr, "F");
      const b = markovEdgeAddress(addr, "B");
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
        const totalMint = sum(contributions.map((x) => nodeWeight(x.address)));
        for (const {address} of contributions) {
          const proportion = nodeWeight(address) / totalMint;
          const edge = seedMintGadget.markovEdge(address, proportion);
          checkMarkovEdge(mpg, edge);
        }
      });
      it("seed node has a radiation-in edge for each organic contribution with pr === alpha", () => {
        const mpg = markovProcessGraph();
        for (const {address} of contributions) {
          const edge = radiationGadget.markovEdge(address, parameters.alpha);
          checkMarkovEdge(mpg, edge);
        }
      });
    });
    describe("personalAttribution", () => {
      it("only returns the latest attribution for a recipient in an epoch", () => {
        const attr = attributions[0];
        const mpg = markovProcessGraph(attributions);
        const interval = intervals[0];
        const recipient = attr.recipients[0];
        const proportion = 0.5;
        const details = {
          epochStart: interval.startTimeMs,
          fromParticipantId: attr.fromParticipantId,
          toParticipantId: recipient.toParticipantId,
        };
        const edge = personalAttributionGadget.markovEdge(
          details,
          parameters.beta * proportion
        );
        checkMarkovEdge(mpg, edge);
      });
      it("propagates the latest proportion into subsequent epochs", () => {
        const attr = attributions[0];
        const mpg = markovProcessGraph(attributions);
        const interval = intervals[1];
        const recipient = attr.recipients[0];
        const proportion = 0.5;
        const details = {
          epochStart: interval.startTimeMs,
          fromParticipantId: attr.fromParticipantId,
          toParticipantId: recipient.toParticipantId,
        };
        const edge = personalAttributionGadget.markovEdge(
          details,
          parameters.beta * proportion
        );
        checkMarkovEdge(mpg, edge);
      });
      it("filters out 0-weighted edge addresses", () => {
        const mpg = markovProcessGraph(attributions);
        const interval = intervals[1];
        const attr = attributions[1];
        const recipient = attr.recipients[0];
        const details = {
          epochStart: interval.startTimeMs,
          fromParticipantId: attr.fromParticipantId,
          toParticipantId: recipient.toParticipantId,
        };
        const containsEdge = Array.from(mpg.edges()).includes(
          personalAttributionGadget.markovEdge(details, 0)
        );
        expect(containsEdge).toBe(false);
      });
      it("filters out 0-weighted edges", () => {
        const mpg = markovProcessGraph(attributions);
        const interval = intervals[1];
        const attr = attributions[1];
        const recipient = attr.recipients[0];
        // $FlowIgnore[cannot-write]
        recipient.proportions[0].proportionValue = 0;
        const details = {
          epochStart: interval.startTimeMs,
          fromParticipantId: attr.fromParticipantId,
          toParticipantId: recipient.toParticipantId,
        };
        const edgeAddress = personalAttributionGadget.toRaw(details);
        const result = mpg.edge(edgeAddress);
        expect(result).toBe(null);
      });
    });

    it("creates participant epoch nodes", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochStarts()) {
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
      for (const boundary of mpg.epochStarts()) {
        const structuredAddress = {
          owner: participant1.id,
          epochStart: boundary,
        };

        const radiationTransitionProbability = NullUtil.get(
          new Map()
            // The participant has no organic incident edges in the first
            // interval, so everything that isn't synthetically accounted for
            // (via the webbing, or payout edge) goes back to seed.
            .set(
              GraphUtil.week1,
              1 -
                parameters.gammaForward -
                parameters.gammaBackward -
                parameters.beta
            )
            // This is a regular interval, (has organic edges),
            // so it sends only `alpha` probability back to seed.
            .set(GraphUtil.week2, parameters.alpha)
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
      for (const boundary of mpg.epochStarts()) {
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
      for (const participant of participants) {
        let lastBoundary = null;
        for (const boundary of mpg.epochStarts()) {
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
          } else {
            // Find the looped backwards edge
            const loopAddress = {
              lastStart: boundary,
              thisStart: boundary,
              owner: participant.id,
            };
            const loop = backwardWebbingGadget.markovEdge(
              loopAddress,
              parameters.gammaBackward
            );
            checkMarkovEdge(mpg, loop);
          }
          lastBoundary = boundary;
        }
        if (lastBoundary == null) {
          // Satisfy flow.
          throw new Error("invariant violation: no epochs");
        }
        // Find the final looped forward edge
        const loopAddress = {
          lastStart: lastBoundary,
          thisStart: lastBoundary,
          owner: participant.id,
        };
        const loop = forwardWebbingGadget.markovEdge(
          loopAddress,
          parameters.gammaForward
        );
        checkMarkovEdge(mpg, loop);
      }
    });

    it("sets up epoch accumulator nodes, with radiation to seed", () => {
      const mpg = markovProcessGraph();
      for (const boundary of mpg.epochStarts()) {
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
        epochStart: GraphUtil.week1,
      });
      const epoch2 = epochGadget.toRaw({
        owner: participant1.id,
        epochStart: GraphUtil.week2,
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
      const expected = args().intervals.map((x) => x.startTimeMs);
      const actual = markovProcessGraph().epochStarts();
      expect(actual).toEqual(expected);
    });
    it("has the correct intervals", () => {
      const expected = args().intervals;
      const actual = markovProcessGraph().intervals();
      expect(actual).toEqual(expected);
    });
    it("there are the same number of epochs as intervals", () => {
      // This test is just a santiy test. If we were to add extra
      // epochs (e.g. padding epochs like we used to have in the past),
      // we'd need to make sure that corresponding intervals get added too.
      const mpg = markovProcessGraph();
      const intervals = mpg.intervals();
      const epochStarts = mpg.epochStarts();
      expect(intervals.length).toEqual(epochStarts.length);
    });
    it("has the right participants", () => {
      expect(markovProcessGraph().participants()).toEqual(participants);
    });
    it("has the right parameters", () => {
      expect(markovProcessGraph().parameters()).toEqual(parameters);
    });
  });

  describe("to/froJSON", () => {
    it("has round trip equality", () => {
      const mpg1 = markovProcessGraph();
      const mpgJson1 = mpg1.toJSON();
      const mpg2 = MarkovProcessGraph.fromJSON(mpgJson1);
      const mpgJson2 = mpg2.toJSON();
      expect(mpg1).toEqual(mpg2);
      expect(mpgJson1).toEqual(mpgJson2);
    });
    it("parser works", async () => {
      const mpg = await markovProcessGraph();
      const mpgJson = markovProcessGraph().toJSON();
      expect(markovProcessGraphParser.parseOrThrow(mpgJson)).toEqual(mpg);
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
