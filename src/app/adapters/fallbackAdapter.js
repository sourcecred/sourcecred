// @flow

import {
  Graph,
  NodeAddress,
  type NodeAddressT,
  EdgeAddress,
} from "../../core/graph";
import type {Repo} from "../../core/repo";

import type {StaticPluginAdapter, DynamicPluginAdapter} from "./pluginAdapter";

export const FALLBACK_NAME = "FALLBACK_ADAPTER";

export class FallbackStaticAdapter implements StaticPluginAdapter {
  name() {
    return FALLBACK_NAME;
  }

  nodePrefix() {
    return NodeAddress.empty;
  }

  edgePrefix() {
    return EdgeAddress.empty;
  }

  nodeTypes() {
    return [
      {name: "(unknown node)", prefix: NodeAddress.empty, defaultWeight: 1},
    ];
  }

  edgeTypes() {
    return [
      {
        forwardName: "(unknown edge→)",
        backwardName: "(unknown edge←)",
        prefix: EdgeAddress.empty,
      },
    ];
  }

  load(_unused_repo: Repo) {
    return Promise.resolve(new FallbackDynamicAdapter());
  }
}

export class FallbackDynamicAdapter implements DynamicPluginAdapter {
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
