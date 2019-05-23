// @flow

import {Graph} from "../../core/graph";
import type {RepoId} from "../../core/repoId";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {
  IAnalysisAdapter,
  IBackendAdapterLoader,
} from "../../analysis/analysisAdapter";

import {declaration} from "./declaration";
import {graph} from "./graph";

export class BackendAdapterLoader implements IBackendAdapterLoader {
  declaration(): PluginDeclaration {
    return declaration;
  }

  load(
    _unused_sourcecredDirectory: string,
    _unused_repoId: RepoId
  ): Promise<AnalysisAdapter> {
    return Promise.resolve(new AnalysisAdapter());
  }
}

export class AnalysisAdapter implements IAnalysisAdapter {
  declaration(): PluginDeclaration {
    return declaration;
  }

  graph(): Graph {
    return graph();
  }
}
