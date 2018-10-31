// @flow

import fs from "fs-extra";
import path from "path";
import pako from "pako";
import {AnalysisAdapter} from "./analysisAdapter";
import {stringToRepoId} from "../../core/repoId";
import {declaration} from "./declaration";
import {RelationalView} from "./relationalView";
import {createGraph} from "./createGraph";

describe("plugins/github/analysisAdapter", () => {
  it("provides the declaration", () => {
    const aa = new AnalysisAdapter();
    expect(aa.declaration()).toEqual(declaration);
  });
  it("loads the GitHub graph", async () => {
    const sourcecredDirectory = path.join(
      "sharness",
      "__snapshots__",
      "example-github-load"
    );
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
    const graph = createGraph(view);
    const aa = new AnalysisAdapter();
    const actualGraph = await aa.load(
      sourcecredDirectory,
      stringToRepoId("sourcecred/example-github")
    );
    expect(actualGraph.equals(graph)).toBe(true);
  });
});
