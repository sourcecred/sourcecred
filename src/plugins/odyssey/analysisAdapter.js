// @flow

import {Graph} from "../../core/graph";
import type {RepoId} from "../../core/repoId";
import type {IAnalysisAdapter} from "../../analysis/analysisAdapter";
import {hackathonExample} from "./example";
import {declaration} from "./declaration";

export class AnalysisAdapter implements IAnalysisAdapter {
  declaration() {
    return declaration;
  }
  // TODO(@decentralion): Enable loading graphs other than the hackathon example.
  async load(
    _unused_sourcecredDirectory: string,
    _unused_repoId: RepoId
  ): Promise<Graph> {
    return hackathonExample().graph();
  }
}
