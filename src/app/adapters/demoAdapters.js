// @flow

import {Assets} from "../assets";
import {
  Graph,
  NodeAddress,
  type NodeAddressT,
  EdgeAddress,
} from "../../core/graph";
import type {
  StaticPluginAdapter,
  DynamicPluginAdapter,
  EdgeType,
  NodeType,
} from "./pluginAdapter";

import {StaticAdapterSet} from "./adapterSet";
import {makeRepo, type Repo} from "../../core/repo";

export const inserterNodeType: NodeType = Object.freeze({
  name: "inserter",
  pluralName: "inserters",
  prefix: NodeAddress.fromParts(["factorio", "inserter"]),
  defaultWeight: 1,
});

export const machineNodeType: NodeType = Object.freeze({
  name: "machine",
  pluralName: "machines",
  prefix: NodeAddress.fromParts(["factorio", "machine"]),
  defaultWeight: 2,
});

export const assemblesEdgeType: EdgeType = Object.freeze({
  forwardName: "assembles",
  defaultForwardWeight: 2,
  backwardName: "is assembled by",
  defaultBackwardWeight: 2 ** -2,
  prefix: EdgeAddress.fromParts(["factorio", "assembles"]),
});

export const transportsEdgeType: EdgeType = Object.freeze({
  forwardName: "transports",
  defaultForwardWeight: 1,
  backwardName: "is transported by",
  defaultBackwardWeight: 2 ** -1,
  prefix: EdgeAddress.fromParts(["factorio", "transports"]),
});

export class FactorioStaticAdapter implements StaticPluginAdapter {
  loadingMock: Function;
  name() {
    return "Factorio demo adapter";
  }
  nodePrefix() {
    return NodeAddress.fromParts(["factorio"]);
  }
  nodeTypes() {
    return [inserterNodeType, machineNodeType];
  }
  edgePrefix() {
    return EdgeAddress.fromParts(["factorio"]);
  }
  edgeTypes() {
    return [assemblesEdgeType, transportsEdgeType];
  }
  async load(assets: Assets, repo: Repo): Promise<DynamicPluginAdapter> {
    if (this.loadingMock) {
      return this.loadingMock(assets, repo).then(
        () => new FactorioDynamicAdapter()
      );
    }
    return Promise.resolve(new FactorioDynamicAdapter());
  }
}

export const factorioNodes = Object.freeze({
  inserter1: NodeAddress.fromParts(["factorio", "inserter", "1"]),
  machine1: NodeAddress.fromParts(["factorio", "machine", "1"]),
  inserter2: NodeAddress.fromParts(["factorio", "inserter", "2"]),
  machine2: NodeAddress.fromParts(["factorio", "machine", "2"]),
});

export const factorioEdges = Object.freeze({
  transports1: Object.freeze({
    src: factorioNodes.inserter1,
    dst: factorioNodes.machine1,
    address: EdgeAddress.fromParts(["factorio", "transports", "1"]),
  }),
  assembles1: Object.freeze({
    src: factorioNodes.machine1,
    dst: factorioNodes.inserter2,
    address: EdgeAddress.fromParts(["factorio", "assembles", "1"]),
  }),
  transports2: Object.freeze({
    src: factorioNodes.inserter2,
    dst: factorioNodes.machine2,
    address: EdgeAddress.fromParts(["factorio", "assembles", "2"]),
  }),
});
export function factorioGraph() {
  return new Graph()
    .addNode(factorioNodes.inserter1)
    .addNode(factorioNodes.inserter2)
    .addNode(factorioNodes.machine1)
    .addNode(factorioNodes.machine2)
    .addEdge(factorioEdges.transports1)
    .addEdge(factorioEdges.transports2)
    .addEdge(factorioEdges.assembles1);
}

export class FactorioDynamicAdapter implements DynamicPluginAdapter {
  graph() {
    return factorioGraph();
  }
  nodeDescription(x: NodeAddressT) {
    return NodeAddress.toString(x);
  }
  static() {
    return new FactorioStaticAdapter();
  }
}

export function staticAdapterSet() {
  return new StaticAdapterSet([new FactorioStaticAdapter()]);
}

export async function dynamicAdapterSet() {
  return await staticAdapterSet().load(
    new Assets("/gateway/"),
    makeRepo("foo", "bar")
  );
}
