// @flow

import deepFreeze from "deep-freeze";
import {
  NodeAddress as NA,
  EdgeAddress as EA,
  type Node as GraphNode,
  type Edge as GraphEdge,
  Graph,
} from "../graph";
import {type WeightsT} from "../weights";
import {type WeightedGraph} from "../weightedGraph";
import {
  type NodeWeightEvaluator,
  type EdgeWeightEvaluator,
  nodeWeightEvaluator,
  edgeWeightEvaluator,
} from "../algorithm/weightEvaluator";
import {
  type Participant as MarkovProcessParticipant,
  type Parameters as MarkovProcessGraphParameters,
  type Arguments as MarkovProcessGraphArguments,
  MarkovProcessGraph,
} from "./markovProcessGraph";
import * as uuid from "../../util/uuid"; // for spy purposes
import {type IntervalSequence, intervalSequence} from "../interval";
import {markovProcessGraphPagerank} from "./compute";
import {CredGraph, type Participant} from "./credGraph";
import {type PersonalAttributions} from "./personalAttribution";
/**
 * This module contains test helpers for working with CredRank data,
 * specifically MarkovProcessGraphs and CredGraphs
 */

const na = (name) => NA.fromParts([name]);
const ea = (name) => EA.fromParts([name]);

export const participantNode1: GraphNode = {
  description: "participant1",
  address: na("participant1"),
  timestampMs: null,
};
export const participantNode2: GraphNode = {
  description: "participant2",
  address: na("participant2"),
  timestampMs: null,
};

export const participantNode3: GraphNode = {
  description: "participant3",
  address: na("participant3"),
  timestampMs: null,
};
export const participantNode4: GraphNode = {
  description: "participant4",
  address: na("participant4"),
  timestampMs: null,
};

export const participantNode5: GraphNode = {
  description: "participant5",
  address: na("participant5"),
  timestampMs: null,
};
export const participantNode6: GraphNode = {
  description: "participant6",
  address: na("participant6"),
  timestampMs: null,
};

deepFreeze([participantNode1, participantNode2]);

export const participant1: MarkovProcessParticipant = {
  description: participantNode1.description,
  address: participantNode1.address,
  id: uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA"),
};
export const participant2: MarkovProcessParticipant = {
  description: participantNode2.description,
  address: participantNode2.address,
  id: uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ"),
};

export const expectedParticipant1: Participant = {
  description: participantNode1.description,
  address: participantNode1.address,
  id: uuid.fromString("YVZhbGlkVXVpZEF0TGFzdA"),
  cred: 2.999999337965189,
  credPerInterval: [0.9479471812187605, 2.0520521567464285],
};
export const expectedParticipant2: Participant = {
  description: participantNode2.description,
  address: participantNode2.address,
  id: uuid.fromString("URgLrCxgvjHxtGJ9PgmckQ"),
  cred: 1.286615549244117e-19,
  credPerInterval: [5.146462196976468e-20, 7.719693295464702e-20],
};

export const participant3: MarkovProcessParticipant = {
  description: participantNode3.description,
  address: participantNode3.address,
  id: uuid.fromString("eHZoNDhmbDN2Z3N3bjg0aA"),
};
export const participant4: MarkovProcessParticipant = {
  description: participantNode4.description,
  address: participantNode4.address,
  id: uuid.fromString("bmdvMzd2bmZqNG5nOTRuaA"),
};

export const expectedParticipant3: Participant = {
  description: participantNode3.description,
  address: participantNode3.address,
  id: uuid.fromString("eHZoNDhmbDN2Z3N3bjg0aA"),
  cred: 0.87108213188,
  credPerInterval: [0.740419825600136, 0.13066230628165218],
};
export const expectedParticipant4: Participant = {
  description: participantNode4.description,
  address: participantNode4.address,
  id: uuid.fromString("bmdvMzd2bmZqNG5nOTRuaA"),
  cred: 2.12891729299,
  credPerInterval: [0.2128917958122319, 1.9160254971783794],
};

//Create a very uneven graph

export const participants: $ReadOnlyArray<MarkovProcessParticipant> = deepFreeze(
  [participant1, participant2]
);

export const intervals: IntervalSequence = deepFreeze(
  intervalSequence([
    {startTimeMs: 0, endTimeMs: 2},
    {startTimeMs: 2, endTimeMs: 4},
  ])
);

const c0 = {description: "c0", address: na("c0"), timestampMs: 0};
const c1 = {description: "c1", address: na("c1"), timestampMs: 2};
export const contributions: $ReadOnlyArray<GraphNode> = deepFreeze([c0, c1]);

// Connects contribution 0 to participant 1
export const e0: GraphEdge = {
  address: ea("e0"),
  src: c0.address,
  dst: participantNode1.address,
  timestampMs: 1,
};

// Connects contribution 1 to participant 1
export const e1: GraphEdge = {
  address: ea("e1"),
  src: c1.address,
  dst: participantNode1.address,
  timestampMs: 3,
};

// Connects c0 to c1.
export const e2: GraphEdge = {
  address: ea("e2"),
  src: c0.address,
  dst: c1.address,
  timestampMs: 4,
};

// Connects c0 to c1, but will be given an explicit weight of 0 in both
// directions, and will be filtered from the MarkovProcessGraph.
export const e3: GraphEdge = {
  address: ea("e3"),
  src: c0.address,
  dst: c1.address,
  timestampMs: 4,
};

export const edges: $ReadOnlyArray<GraphEdge> = deepFreeze([e0, e1, e2, e3]);

export const parameters: MarkovProcessGraphParameters = deepFreeze({
  beta: 0.2,
  gammaForward: 0.15,
  gammaBackward: 0.1,
  alpha: 0.2,
});

export function graph(): Graph {
  const g = new Graph();
  g.addNode(participantNode1);
  g.addNode(participantNode2);
  for (const c of contributions) {
    g.addNode(c);
  }
  for (const e of edges) {
    g.addEdge(e);
  }
  return g;
}
export function weights(): WeightsT {
  const nodeWeights = new Map().set(c0.address, 1).set(c1.address, 2);
  const edgeWeights = new Map()
    .set(e0.address, {forwards: 1, backwards: 0})
    .set(e1.address, {forwards: 2, backwards: 1})
    // e2 is unset, which results in implicit {1, 1}
    .set(e3.address, {forwards: 0, backwards: 0});
  return {nodeWeights, edgeWeights};
}

export const nodeWeight: NodeWeightEvaluator = nodeWeightEvaluator(weights());
export const edgeWeight: EdgeWeightEvaluator = edgeWeightEvaluator(weights());
export const weightedGraph: () => WeightedGraph = () => ({
  weights: weights(),
  graph: graph(),
});
export const args = (
  personalAttributions?: PersonalAttributions = []
): MarkovProcessGraphArguments => ({
  weightedGraph: weightedGraph(),
  parameters,
  intervals,
  participants: [participant1, participant2],
  personalAttributions,
});
const attribution1 = {
  fromParticipantId: participant1.id,
  recipients: [
    {
      toParticipantId: participant2.id,
      proportions: [
        {timestampMs: -2, proportionValue: 0.2},
        {timestampMs: -1, proportionValue: 0.1},
        {timestampMs: 0, proportionValue: 0.5},
      ],
    },
  ],
};

const attribution2 = {
  fromParticipantId: participant2.id,
  recipients: [
    {
      toParticipantId: participant1.id,
      proportions: [{timestampMs: 2, proportionValue: 0.3}],
    },
  ],
};
export const attributions: PersonalAttributions = [attribution1, attribution2];

export const markovProcessGraph = (
  attributions?: PersonalAttributions = []
): MarkovProcessGraph => MarkovProcessGraph.new(args(attributions));

export const credGraph: () => Promise<CredGraph> = async () =>
  markovProcessGraphPagerank(markovProcessGraph());

//Create a more balanced cred allocation:

const c3 = {description: "c3", address: na("c3"), timestampMs: 0};
const c4 = {description: "c4", address: na("c4"), timestampMs: 2};
export const contributions2: $ReadOnlyArray<GraphNode> = deepFreeze([c3, c4]);

// Connects contribution 3 to participant 3
export const e4: GraphEdge = {
  address: ea("e4"),
  src: c3.address,
  dst: participantNode3.address,
  timestampMs: 1,
};

// Connects contribution 4 to participant 4
export const e5: GraphEdge = {
  address: ea("e5"),
  src: c4.address,
  dst: participantNode4.address,
  timestampMs: 3,
};

// Connects c3 to c4.
export const e6: GraphEdge = {
  address: ea("e6"),
  src: c3.address,
  dst: c4.address,
  timestampMs: 4,
};

export const e7: GraphEdge = {
  address: ea("e3"),
  src: c3.address,
  dst: c4.address,
  timestampMs: 4,
};

export const edges2: $ReadOnlyArray<GraphEdge> = deepFreeze([e4, e5, e6, e7]);

export const parameters2: MarkovProcessGraphParameters = deepFreeze({
  beta: 0.2,
  gammaForward: 0.15,
  gammaBackward: 0.1,
  alpha: 0.2,
});

export function graph2(): Graph {
  const g = new Graph();
  g.addNode(participantNode3);
  g.addNode(participantNode4);
  for (const c of contributions2) {
    g.addNode(c);
  }
  for (const e of edges2) {
    g.addEdge(e);
  }
  return g;
}
export function weights2(): WeightsT {
  const nodeWeights = new Map().set(c3.address, 1).set(c4.address, 2);
  const edgeWeights = new Map()
    .set(e4.address, {forwards: 1, backwards: 0})
    .set(e5.address, {forwards: 2, backwards: 1})
    .set(e6.address, {forwards: 0, backwards: 0});
  return {nodeWeights, edgeWeights};
}

export const nodeWeight2: NodeWeightEvaluator = nodeWeightEvaluator(weights2());
export const edgeWeight2: EdgeWeightEvaluator = edgeWeightEvaluator(weights2());
export const weightedGraph2: () => WeightedGraph = () => ({
  weights: weights2(),
  graph: graph2(),
});
export const args2 = (
  personalAttributions?: PersonalAttributions = []
): MarkovProcessGraphArguments => ({
  weightedGraph: weightedGraph2(),
  parameters,
  intervals,
  participants: [participant3, participant4],
  personalAttributions,
});
const attribution3 = {
  fromParticipantId: participant3.id,
  recipients: [
    {
      toParticipantId: participant4.id,
      proportions: [
        {timestampMs: -2, proportionValue: 0.2},
        {timestampMs: -1, proportionValue: 0.1},
        {timestampMs: 0, proportionValue: 0.5},
      ],
    },
  ],
};

const attribution4 = {
  fromParticipantId: participant4.id,
  recipients: [
    {
      toParticipantId: participant3.id,
      proportions: [{timestampMs: 2, proportionValue: 0.3}],
    },
  ],
};
export const attributions2: PersonalAttributions = [attribution3, attribution4];

export const markovProcessGraph2 = (
  attributions2?: PersonalAttributions = []
): MarkovProcessGraph => MarkovProcessGraph.new(args2(attributions2));

export const credGraph2: () => Promise<CredGraph> = async () =>
  markovProcessGraphPagerank(markovProcessGraph2());
