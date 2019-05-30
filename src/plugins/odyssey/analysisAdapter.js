// @flow

import type {RepoId} from "../../core/repoId";
import {type NodeAddressT} from "../../core/graph";
import type {
  IBackendAdapterLoader,
  IAnalysisAdapter,
} from "../../analysis/analysisAdapter";
import {hackathonExample} from "./example";
import {declaration} from "./declaration";

export class BackendAdapterLoader implements IBackendAdapterLoader {
  declaration() {
    return declaration;
  }
  // TODO(@decentralion): Enable loading graphs other than the hackathon example.
  load(
    _unused_sourcecredDirectory: string,
    _unused_repoId: RepoId
  ): Promise<AnalysisAdapter> {
    const aa: AnalysisAdapter = new AnalysisAdapter();
    // HACK: This any-coercion should be unncessary. Sad flow.
    return Promise.resolve((aa: any));
  }
}

export class AnalysisAdapter implements IAnalysisAdapter {
  declaration() {
    return declaration;
  }
  // TODO(@decentralion): Add real creation times to the data model
  createdAt(_unused_node: NodeAddressT): null {
    return null;
  }
  graph() {
    return hackathonExample().graph();
  }
}
