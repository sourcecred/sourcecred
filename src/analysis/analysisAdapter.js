// @flow

import {Graph} from "../core/graph";
import type {RepoId} from "../core/repoId";
import type {PluginDeclaration} from "./pluginDeclaration";

export interface IAnalysisAdapter {
  declaration(): PluginDeclaration;
  load(sourcecredDirectory: string, repoId: RepoId): Promise<Graph>;
}
