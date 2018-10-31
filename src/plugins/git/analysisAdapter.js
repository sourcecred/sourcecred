// @flow

import fs from "fs-extra";
import path from "path";
import {Graph} from "../../core/graph";
import type {IAnalysisAdapter} from "../../analysis/analysisAdapter";
import {type RepoId, repoIdToString} from "../../core/repoId";
import {declaration} from "./declaration";

export class AnalysisAdapter implements IAnalysisAdapter {
  declaration() {
    return declaration;
  }
  async load(sourcecredDirectory: string, repoId: RepoId): Promise<Graph> {
    const file = path.join(
      sourcecredDirectory,
      "data",
      repoIdToString(repoId),
      "git",
      "graph.json"
    );
    const rawData = await fs.readFile(file);
    const json = JSON.parse(rawData.toString());
    return Graph.fromJSON(json);
  }
}
