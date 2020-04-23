// @flow

import {
  type Edge,
  type Node,
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import type {ReferenceDetector, URL} from "../../core/references";
import {type WeightedGraph as WeightedGraphT} from "../../core/weightedGraph";
import * as WeightedGraph from "../../core/weightedGraph";
import type {NodeWeight} from "../../core/weights";
import type {EdgeSpec} from "./edgeSpec";
import {
  type Initiative,
  type InitiativeId,
  type InitiativeRepository,
  addressFromId,
} from "./initiative";
import {
  type NodeEntry,
  type NodeEntryField,
  addressForNodeEntry,
} from "./nodeEntry";
import {
  dependsOnEdgeType,
  referencesEdgeType,
  contributesToEdgeType,
  championsEdgeType,
  contributesToEntryEdgeType,
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

function nodeFromEntry(
  entry: NodeEntry,
  parentId: InitiativeId,
  field: NodeEntryField
): Node {
  const address = addressForNodeEntry(field, parentId, entry.key);
  return {
    address,
    timestampMs: entry.timestampMs,
    description: entry.title,
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

    // Generic approach to adding edges and entries from EdgeSpec or URLs.
    const edgeHandler = (
      edges: $ReadOnlyArray<URL> | EdgeSpec,
      createEdge: EdgeFactoryT,
      field: ?NodeEntryField
    ) => {
      const {urls, entries} = Array.isArray(edges)
        ? {urls: edges, entries: []}
        : edges;

      // Handle edge URLs.
      for (const url of urls) {
        const addr = refs.addressFromUrl(url);
        if (!addr) continue;
        graph.addEdge(createEdge(initiative, addr));
      }

      // Handle NodeEntry when a field is set.
      for (const entry of entries) {
        if (!field) throw new Error("BUG: field not set, but got entries");

        // Add the NodeEntry contribution itself to the graph.
        const node = nodeFromEntry(entry, initiative.id, field);
        graph.addNode(node);
        graph.addEdge(createEdge(initiative, node.address));
        if (entry.weight != null) {
          weights.nodeWeights.set(node.address, entry.weight);
        }

        // Add edges to the contributors.
        for (const contributor of entry.contributors) {
          const addr = refs.addressFromUrl(contributor);
          if (!addr) continue;
          graph.addEdge({
            address: EdgeAddress.append(
              contributesToEntryEdgeType.prefix,
              ...NodeAddress.toParts(node.address),
              ...NodeAddress.toParts(addr)
            ),
            timestampMs: entry.timestampMs,
            src: addr,
            dst: node.address,
          });
        }
      }
    };

    // Maps the edge types to it's fields.
    edgeHandler(initiative.dependencies, depedencyEdge, "DEPENDENCY");
    edgeHandler(initiative.references, referenceEdge, "REFERENCE");
    edgeHandler(initiative.contributions, contributionEdge, "CONTRIBUTION");
    edgeHandler(initiative.champions, championEdge, null);
  }

  return wg;
}
