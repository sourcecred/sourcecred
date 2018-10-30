// @flow

import fs from "fs-extra";
import path from "path";
import pako from "pako";
import {type RepoId, repoIdToString} from "../../core/repoId";
import {Graph} from "../../core/graph";
import type {IAnalysisAdapter} from "../../analysis/analysisAdapter";
import {declaration} from "./declaration";
import {RelationalView} from "./relationalView";
import {createGraph} from "./createGraph";

export class AnalysisAdapter implements IAnalysisAdapter {
  declaration() {
    return declaration;
  }
  async load(sourcecredDirectory: string, repoId: RepoId): Promise<Graph> {
    const file = path.join(
      sourcecredDirectory,
      "data",
      repoIdToString(repoId),
      "github",
      "view.json.gz"
    );
    const compressedData = await fs.readFile(file);
    const json = JSON.parse(pako.ungzip(compressedData, {to: "string"}));
    const view = RelationalView.fromJSON(json);
    return createGraph(view);
  }
}
