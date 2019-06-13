// @flow

import fs from "fs-extra";
import path from "path";
import pako from "pako";
import {BackendAdapterLoader} from "./analysisAdapter";
import {stringToRepoId} from "../../core/repoId";
import {declaration} from "./declaration";
import {RelationalView} from "./relationalView";
import {createGraph} from "./createGraph";

describe("plugins/github/analysisAdapter", () => {
  it("the loader provides the declaration", () => {
    const loader = new BackendAdapterLoader();
    expect(loader.declaration()).toEqual(declaration);
  });
  describe("can load an AnalysisAdapter which", () => {
    const sourcecredDirectory = path.join(
      "sharness",
      "__snapshots__",
      "example-github-load"
    );
    async function loadView() {
      const expectedPath = path.join(
        sourcecredDirectory,
        "data",
        "sourcecred",
        "example-github",
        "github",
        "view.json.gz"
      );
      const blob = await fs.readFile(expectedPath);
      const json = JSON.parse(pako.ungzip(blob, {to: "string"}));
      const view = RelationalView.fromJSON(json);
      return view;
    }
    const loadAnalysisAdapter = () =>
      new BackendAdapterLoader().load(
        sourcecredDirectory,
        stringToRepoId("sourcecred/example-github")
      );
    it("loads the GitHub graph", async () => {
      const view = await loadView();
      const expectedGraph = createGraph(view);
      const aa = await loadAnalysisAdapter();
      const actualGraph = aa.graph();
      expect(actualGraph.equals(expectedGraph)).toBe(true);
    });
    it("provides the declaration", async () => {
      const aa = await loadAnalysisAdapter();
      expect(aa.declaration()).toEqual(declaration);
    });
  });
});
