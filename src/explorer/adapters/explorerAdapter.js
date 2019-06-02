// @flow

import {type Node as ReactNode} from "react";
import {Graph, type NodeAddressT} from "../../core/graph";
import type {Assets} from "../../webutil/assets";
import type {RepoId} from "../../core/repoId";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";

export interface StaticExplorerAdapter {
  declaration(): PluginDeclaration;
  load(assets: Assets, repoId: RepoId): Promise<DynamicExplorerAdapter>;
}

export interface DynamicExplorerAdapter {
  graph(): Graph;
  // Gives the description as a ReactNode.
  // I intend to deprecate this in favor of the Markdown descriptions defined
  // on the AnalysisAdapter.
  nodeDescription(NodeAddressT): ReactNode;
  static (): StaticExplorerAdapter;
}
