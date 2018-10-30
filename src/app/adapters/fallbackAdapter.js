// @flow

import {
  Graph,
  NodeAddress,
  type NodeAddressT,
  EdgeAddress,
} from "../../core/graph";
import type {Assets} from "../assets";
import type {RepoId} from "../../core/repoId";

import type {StaticAppAdapter, DynamicAppAdapter} from "./appAdapter";

export const FALLBACK_NAME = "FALLBACK_ADAPTER";

export const fallbackNodeType = Object.freeze({
  name: "node",
  pluralName: "nodes",
  prefix: NodeAddress.empty,
  defaultWeight: 1,
});

export const fallbackEdgeType = Object.freeze({
  forwardName: "forward edge",
  backwardName: "backward edge",
  defaultForwardWeight: 1,
  defaultBackwardWeight: 1,
  prefix: EdgeAddress.empty,
});

export const fallbackDeclaration = Object.freeze({
  name: FALLBACK_NAME,
  nodePrefix: NodeAddress.empty,
  edgePrefix: EdgeAddress.empty,
  nodeTypes: [fallbackNodeType],
  edgeTypes: [fallbackEdgeType],
});

export class FallbackStaticAdapter implements StaticAppAdapter {
  declaration() {
    return fallbackDeclaration;
  }

  load(_unused_assets: Assets, _unused_repoId: RepoId) {
    return Promise.resolve(new FallbackDynamicAdapter());
  }
}

export class FallbackDynamicAdapter implements DynamicAppAdapter {
  graph() {
    return new Graph();
  }

  nodeDescription(x: NodeAddressT) {
    return NodeAddress.toString(x);
  }

  static() {
    return new FallbackStaticAdapter();
  }
}
