// @flow

import fs from "fs-extra";
import path from "path";
import pako from "pako";
import {type RepoId, repoIdToString} from "../../core/repoId";
import type {
  IAnalysisAdapter,
  IBackendAdapterLoader,
} from "../../analysis/analysisAdapter";
import {declaration} from "./declaration";
import {RelationalView} from "./relationalView";
import {createGraph} from "./createGraph";

export class BackendAdapterLoader implements IBackendAdapterLoader {
  declaration() {
    return declaration;
  }
  async load(
    sourcecredDirectory: string,
    repoId: RepoId
  ): Promise<AnalysisAdapter> {
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
    return new AnalysisAdapter(view);
  }
}

export class AnalysisAdapter implements IAnalysisAdapter {
  _view: RelationalView;
  constructor(view: RelationalView) {
    this._view = view;
  }
  declaration() {
    return declaration;
  }

  graph() {
    return createGraph(this._view);
  }
}
