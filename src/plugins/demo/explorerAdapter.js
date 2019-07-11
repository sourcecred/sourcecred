// @flow

import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {declaration} from "./declaration";
import type {
  StaticExplorerAdapter,
  DynamicExplorerAdapter,
} from "../../explorer/legacy/adapters/explorerAdapter";
import {StaticExplorerAdapterSet} from "../../explorer/legacy/adapters/explorerAdapterSet";
import {Assets} from "../../webutil/assets";
import {type RepoId, makeRepoId} from "../../core/repoId";
import {NodeAddress, type NodeAddressT} from "../../core/graph";
import {graph} from "./graph";

export class FactorioStaticAdapter implements StaticExplorerAdapter {
  loadingMock: (assets: Assets, repoId: RepoId) => Promise<mixed>;
  declaration(): PluginDeclaration {
    return declaration;
  }
  async load(assets: Assets, repoId: RepoId) {
    const result: FactorioDynamicAdapter = new FactorioDynamicAdapter();
    if (this.loadingMock) {
      return this.loadingMock(assets, repoId).then(() => result);
    }
    return Promise.resolve(result);
  }
}

export class FactorioDynamicAdapter implements DynamicExplorerAdapter {
  graph() {
    return graph();
  }
  nodeDescription(x: NodeAddressT) {
    return `[factorio]: ${NodeAddress.toString(x)}`;
  }
  static(): FactorioStaticAdapter {
    return new FactorioStaticAdapter();
  }
}

export function staticExplorerAdapterSet() {
  return new StaticExplorerAdapterSet([new FactorioStaticAdapter()]);
}

export async function dynamicExplorerAdapterSet() {
  return await staticExplorerAdapterSet().load(
    new Assets("/gateway/"),
    makeRepoId("foo", "bar")
  );
}
