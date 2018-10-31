// @flow

import fs from "fs-extra";
import path from "path";
import {AnalysisAdapter} from "./analysisAdapter";
import {stringToRepoId} from "../../core/repoId";
import {declaration} from "./declaration";
import {Graph} from "../../core/graph";

describe("plugins/git/analysisAdapter", () => {
  it("provides the declaration", () => {
    const aa = new AnalysisAdapter();
    expect(aa.declaration()).toEqual(declaration);
  });
  it("loads the Git graph", async () => {
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
      "git",
      "graph.json"
    );
    const expectedGraphBuffer: Buffer = await fs.readFile(expectedPath);
    const expectedGraphJSON = JSON.parse(expectedGraphBuffer.toString());
    const expectedGraph = Graph.fromJSON(expectedGraphJSON);
    const aa = new AnalysisAdapter();
    const actualGraph = await aa.load(
      sourcecredDirectory,
      stringToRepoId("sourcecred/example-github")
    );
    expect(actualGraph.equals(expectedGraph)).toBe(true);
  });
});
