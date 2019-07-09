// @flow

import fs from "fs-extra";
import path from "path";
import {BackendAdapterLoader} from "./analysisAdapter";
import {stringToRepoId} from "../../core/repoId";
import {declaration} from "./declaration";
import {Graph} from "../../core/graph";

// This test is skipped because the Git plugin is currently disabled, but the
// tests depend on data being loaded in the `sourcecred load` snapshot. I
// elected to disable the test rather than update it because I consider the
// AnalysisAdapters deprecated now that the Graph natively contains
// descriptions and timestamps. Rather than having an AnalysisAdapter, we
// should just use the graph file directly.
describe.skip("plugins/git/analysisAdapter", () => {
  const sourcecredDirectory = path.join(
    "sharness",
    "__snapshots__",
    "example-github-load"
  );
  it("the loader provides the declaration", () => {
    const loader = new BackendAdapterLoader();
    expect(loader.declaration()).toEqual(declaration);
  });
  describe("can load an AnalysisAdapter which", () => {
    const loadAnalysisAdapter = () =>
      new BackendAdapterLoader().load(
        sourcecredDirectory,
        stringToRepoId("sourcecred/example-github")
      );
    it("loads the Git graph", async () => {
      const graphPath = path.join(
        sourcecredDirectory,
        "data",
        "sourcecred",
        "example-github",
        "git",
        "graph.json"
      );
      const expectedGraphBuffer: Buffer = await fs.readFile(graphPath);
      const expectedGraphJSON = JSON.parse(expectedGraphBuffer.toString());
      const expectedGraph = Graph.fromJSON(expectedGraphJSON);
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
