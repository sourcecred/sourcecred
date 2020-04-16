// @flow

import {
  EdgeAddress,
  NodeAddress,
  type Edge,
  type Node,
  type EdgeAddressT,
  type NodeAddressT,
} from "../../core/graph";
import {type WeightedGraph as WeightedGraphT} from "../../core/weightedGraph";
import * as WeightedGraph from "../../core/weightedGraph";
import type {NodeWeight} from "../../core/weights";
import type {ReferenceDetector, URL} from "../../core/references";
import type {Initiative, InitiativeRepository} from "./initiative";
import {addressFromId} from "./initiative";
import {
  dependsOnEdgeType,
  referencesEdgeType,
  contributesToEdgeType,
  championsEdgeType,
} from "./declaration";
import {initiativeFileURL} from "./initiativeFile";

function initiativeAddress(initiative: Initiative): NodeAddressT {
  return addressFromId(initiative.id);
}

function initiativeNode(initiative: Initiative): Node {
  const address = initiativeAddress(initiative);
  const url = initiativeFileURL(address);
  return {
    address,
    timestampMs: initiative.timestampMs,
    description:
      url == null ? initiative.title : `[${initiative.title}](${url})`,
  };
}

export function initiativeWeight(initiative: Initiative): ?NodeWeight {
  if (!initiative.weight) return;
  return initiative.completed
    ? initiative.weight.complete
    : initiative.weight.incomplete;
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

export function createWeightedGraph(
  repo: InitiativeRepository,
  refs: ReferenceDetector
): WeightedGraphT {
  const wg = WeightedGraph.empty();
  const {graph, weights} = wg;

  for (const initiative of repo.initiatives()) {
    // Adds the Initiative node.
    const node = initiativeNode(initiative);
    const weight = initiativeWeight(initiative);
    graph.addNode(node);
    if (weight) {
      weights.nodeWeights.set(node.address, weight);
    }

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

  return wg;
}
