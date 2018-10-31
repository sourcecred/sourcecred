// @flow

import {Graph} from "../../core/graph";
import type {RepoId} from "../../core/repoId";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {IAnalysisAdapter} from "../../analysis/analysisAdapter";

import {declaration} from "./declaration";
import {graph} from "./graph";

export class AnalysisAdapter implements IAnalysisAdapter {
  loadingMock: (sourcecredDirectory: string, repoId: RepoId) => Promise<mixed>;
  declaration(): PluginDeclaration {
    return declaration;
  }

  load(sourcecredDirectory: string, repoId: RepoId): Promise<Graph> {
    if (this.loadingMock) {
      return this.loadingMock(sourcecredDirectory, repoId).then(() => graph());
    }
    return Promise.resolve(graph());
  }
}
