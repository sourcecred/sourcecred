// @flow

import {fallbackDeclaration} from "../../analysis/fallbackDeclaration";
import type {
  StaticExplorerAdapter,
  DynamicExplorerAdapter,
} from "./explorerAdapter";
import {Assets} from "../../webutil/assets";
import {type RepoId} from "../../core/repoId";
import {Graph, NodeAddress, type NodeAddressT} from "../../core/graph";

export class FallbackStaticAdapter implements StaticExplorerAdapter {
  declaration() {
    return fallbackDeclaration;
  }

  load(_unused_assets: Assets, _unused_repoId: RepoId) {
    return Promise.resolve(new FallbackDynamicAdapter());
  }
}

export class FallbackDynamicAdapter implements DynamicExplorerAdapter {
  graph() {
    return new Graph();
  }

  nodeDescription(x: NodeAddressT) {
    return `[fallback]: ${NodeAddress.toString(x)}`;
  }

  static(): FallbackStaticAdapter {
    return new FallbackStaticAdapter();
  }
}
