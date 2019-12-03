// @flow

import {
  Graph,
  EdgeAddress,
  NodeAddress,
  type Edge,
  type Node,
  type EdgeAddressT,
  type NodeAddressT,
} from "../../core/graph";
import type {ReferenceDetector, URL} from "../../core/references";
import type {Initiative, InitiativeRepository} from "./initiative";
import {
  initiativeNodeType,
  dependsOnEdgeType,
  referencesEdgeType,
  contributesToEdgeType,
  championsEdgeType,
} from "./declaration";

function initiativeAddress(initiative: Initiative): NodeAddressT {
  return NodeAddress.append(
    initiativeNodeType.prefix,
    ...NodeAddress.toParts(initiative.tracker)
  );
}

function initiativeNode(initiative: Initiative): Node {
  return {
    address: initiativeAddress(initiative),
    timestampMs: initiative.timestampMs,
    description: initiative.title,
  };
}

type EdgeFactoryT = (initiative: Initiative, other: NodeAddressT) => Edge;

function edgeFactory(
  prefix: EdgeAddressT,
  fromInitiative: boolean
): EdgeFactoryT {
  return (initiative: Initiative, other: NodeAddressT): Edge => {
    const iAddr = initiativeAddress(initiative);
    const src = fromInitiative ? iAddr : other;
    const dst = fromInitiative ? other : iAddr;
    return {
      address: EdgeAddress.append(
        prefix,
        ...NodeAddress.toParts(initiativeAddress(initiative)),
        ...NodeAddress.toParts(other)
      ),
      timestampMs: initiative.timestampMs,
      src,
      dst,
    };
  };
}

const depedencyEdge = edgeFactory(dependsOnEdgeType.prefix, true);
const referenceEdge = edgeFactory(referencesEdgeType.prefix, true);
const contributionEdge = edgeFactory(contributesToEdgeType.prefix, false);
const championEdge = edgeFactory(championsEdgeType.prefix, false);

export function createGraph(
  repo: InitiativeRepository,
  refs: ReferenceDetector
): Graph {
  const graph = new Graph();

  for (const initiative of repo.initiatives()) {
    // Adds the Initiative node.
    graph.addNode(initiativeNode(initiative));

    // Consider the tracker a contribution.
    graph.addEdge(contributionEdge(initiative, initiative.tracker));

    // Generic approach to adding edges when the reference detector has a hit.
    const edgeHandler = (
      urls: $ReadOnlyArray<URL>,
      createEdge: EdgeFactoryT
    ) => {
      for (const url of urls) {
        const addr = refs.addressFromUrl(url);
        if (!addr) continue;
        graph.addEdge(createEdge(initiative, addr));
      }
    };

    // Maps the edge types to it's fields.
    edgeHandler(initiative.dependencies, depedencyEdge);
    edgeHandler(initiative.references, referenceEdge);
    edgeHandler(initiative.contributions, contributionEdge);
    edgeHandler(initiative.champions, championEdge);
  }

  return graph;
}
