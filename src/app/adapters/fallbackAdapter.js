// @flow

import {
  Graph,
  NodeAddress,
  type NodeAddressT,
  EdgeAddress,
} from "../../core/graph";
import type {Assets} from "../assets";
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
      {
        name: "unknown node",
        pluralName: "unknown nodes",
        prefix: NodeAddress.empty,
        defaultWeight: 1,
      },
    ];
  }

  edgeTypes() {
    return [
      {
        forwardName: "unknown edge→",
        backwardName: "unknown edge←",
        defaultForwardWeight: 1,
        defaultBackwardWeight: 1,
        prefix: EdgeAddress.empty,
      },
    ];
  }

  load(_unused_assets: Assets, _unused_repo: Repo) {
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
