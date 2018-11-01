// @flow

import {Graph} from "../core/graph";
import type {RepoId} from "../core/repoId";
import type {PluginDeclaration} from "./pluginDeclaration";
import type {IAnalysisAdapter} from "./analysisAdapter";

import {fallbackDeclaration} from "./fallbackDeclaration";

export class FallbackAdapter implements IAnalysisAdapter {
  declaration(): PluginDeclaration {
    return fallbackDeclaration;
  }

  load(
    _unused_sourcecredDirectory: string,
    _unused_repoId: RepoId
  ): Promise<Graph> {
    return Promise.resolve(new Graph());
  }
}
