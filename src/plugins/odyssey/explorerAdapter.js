// @flow

import type {Assets} from "../../webutil/assets";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {RepoId} from "../../core/repoId";
import type {
  StaticExplorerAdapter as IStaticExplorerAdapter,
  DynamicExplorerAdapter as IDynamicExplorerAdapter,
} from "../../explorer/adapters/explorerAdapter";
import {NodeAddress, type NodeAddressT} from "../../core/graph";
import {declaration} from "./declaration";
import {OdysseyInstance} from "./instance";
import {hackathonExample} from "./example";

export class StaticExplorerAdapter implements IStaticExplorerAdapter {
  declaration(): PluginDeclaration {
    return declaration;
  }

  // TODO(@decentralion): Enable loading instances other than the hackathon example.
  async load(
    _unused_assets: Assets,
    _unused_repoId: RepoId
  ): Promise<IDynamicExplorerAdapter> {
    const instance = hackathonExample();
    return new DynamicExplorerAdapter(instance);
  }
}

class DynamicExplorerAdapter implements IDynamicExplorerAdapter {
  +_instance: OdysseyInstance;
  constructor(instance: OdysseyInstance): void {
    this._instance = instance;
  }
  nodeDescription(address: NodeAddressT) {
    const node = this._instance.node(address);
    if (node == null) {
      throw new Error(`No Odyssey node for: ${NodeAddress.toString(address)}`);
    }
    return node.description;
  }
  graph() {
    return this._instance.graph();
  }
  static() {
    return new StaticExplorerAdapter();
  }
}
