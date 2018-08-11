// @flow

import {
  Graph,
  NodeAddress,
  EdgeAddress,
  type NodeAddressT,
  type EdgeAddressT,
} from "../../core/graph";
import type {Repo} from "../../core/repo";

export type EdgeType = {|
  +forwardName: string,
  +backwardName: string,
  +prefix: EdgeAddressT,
|};

export type NodeType = {|
  +name: string,
  +prefix: NodeAddressT,
  +defaultWeight: number,
|};

export interface StaticPluginAdapter {
  name(): string;
  nodePrefix(): NodeAddressT;
  edgePrefix(): EdgeAddressT;
  nodeTypes(): NodeType[];
  edgeTypes(): EdgeType[];
  load(repo: Repo): Promise<DynamicPluginAdapter>;
}

export interface DynamicPluginAdapter {
  graph(): Graph;
  nodeDescription(NodeAddressT): string;
  static (): StaticPluginAdapter;
}

function findUniqueMatch<T>(
  xs: $ReadOnlyArray<T>,
  predicate: (T) => boolean
): T {
  const results = xs.filter(predicate);
  if (results.length > 1) {
    throw new Error("Multiple entities match predicate");
  }
  if (results.length === 0) {
    throw new Error("No entity matches predicate");
  }
  return results[0];
}

export function staticDispatchByNode(
  adapters: $ReadOnlyArray<StaticPluginAdapter>,
  x: NodeAddressT
): StaticPluginAdapter {
  return findUniqueMatch(adapters, (a) =>
    NodeAddress.hasPrefix(x, a.nodePrefix())
  );
}

export function staticDispatchByEdge(
  adapters: $ReadOnlyArray<StaticPluginAdapter>,
  x: EdgeAddressT
): StaticPluginAdapter {
  return findUniqueMatch(adapters, (a) =>
    EdgeAddress.hasPrefix(x, a.edgePrefix())
  );
}

export function dynamicDispatchByNode(
  adapters: $ReadOnlyArray<DynamicPluginAdapter>,
  x: NodeAddressT
): DynamicPluginAdapter {
  return findUniqueMatch(adapters, (a) =>
    NodeAddress.hasPrefix(x, a.static().nodePrefix())
  );
}

export function dynamicDispatchByEdge(
  adapters: $ReadOnlyArray<DynamicPluginAdapter>,
  x: EdgeAddressT
): DynamicPluginAdapter {
  return findUniqueMatch(adapters, (a) =>
    EdgeAddress.hasPrefix(x, a.static().edgePrefix())
  );
}

export function findNodeType(
  adapter: StaticPluginAdapter,
  x: NodeAddressT
): NodeType {
  if (!NodeAddress.hasPrefix(x, adapter.nodePrefix())) {
    throw new Error("Trying to find NodeType from the wrong plugin adapter");
  }
  return findUniqueMatch(adapter.nodeTypes(), (t) =>
    NodeAddress.hasPrefix(x, t.prefix)
  );
}

export function findEdgeType(
  adapter: StaticPluginAdapter,
  x: EdgeAddressT
): EdgeType {
  if (!EdgeAddress.hasPrefix(x, adapter.edgePrefix())) {
    throw new Error("Trying to find EdgeType from the wrong plugin adapter");
  }
  return findUniqueMatch(adapter.edgeTypes(), (t) =>
    EdgeAddress.hasPrefix(x, t.prefix)
  );
}
