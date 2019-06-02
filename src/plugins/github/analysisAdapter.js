// @flow

import fs from "fs-extra";
import path from "path";
import pako from "pako";
import stringify from "json-stable-stringify";
import {type RepoId, repoIdToString} from "../../core/repoId";
import type {
  IAnalysisAdapter,
  IBackendAdapterLoader,
  MsSinceEpoch,
} from "../../analysis/analysisAdapter";
import {declaration} from "./declaration";
import {RelationalView} from "./relationalView";
import {createGraph} from "./createGraph";
import {createdAt} from "./createdAt";
import {fromRaw} from "./nodes";
import {type NodeAddressT} from "../../core/graph";
import {description} from "./description";

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
  createdAt(n: NodeAddressT): MsSinceEpoch | null {
    const addr = fromRaw((n: any));
    const entity = this._view.entity(addr);
    if (entity == null) {
      throw new Error(`No entity matching ${stringify(addr)}`);
    }
    return createdAt(entity);
  }
  graph() {
    return createGraph(this._view);
  }
  description(n: NodeAddressT): string | null {
    const addr = fromRaw((n: any));
    const entity = this._view.entity(addr);
    if (entity == null) {
      return null;
    }
    return description(entity);
  }
}
