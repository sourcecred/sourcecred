// @flow

import {type Node as ReactNode} from "react";
import {Graph, type NodeAddressT} from "../../core/graph";
import type {Assets} from "../assets";
import type {RepoId} from "../../core/repoId";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";

export interface StaticAppAdapter {
  declaration(): PluginDeclaration;
  load(assets: Assets, repoId: RepoId): Promise<DynamicAppAdapter>;
}

export interface DynamicAppAdapter {
  graph(): Graph;
  nodeDescription(NodeAddressT): ReactNode;
  static (): StaticAppAdapter;
}
