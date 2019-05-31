// @flow

import fs from "fs-extra";
import path from "path";
import {BackendAdapterLoader} from "./analysisAdapter";
import {stringToRepoId} from "../../core/repoId";
import {declaration} from "./declaration";
import {Graph, NodeAddress} from "../../core/graph";
import {toRaw} from "./nodes";

describe("plugins/git/analysisAdapter", () => {
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
    describe("has a createdAt method which", () => {
      it("provides createdAt times", async () => {
        const aa = await loadAnalysisAdapter();
        const hash = "0a223346b4e6dec0127b1e6aa892c4ee0424b66a";
        const commitAddr = toRaw({type: "COMMIT", hash});
        const actualCreatedAt = aa.createdAt(commitAddr);
        expect(actualCreatedAt).toEqual(1519807427000);
      });
      it("returns null for an absent commit hash", async () => {
        // This is a little hacky. See #1163 for discussion.
        // https://github.com/sourcecred/sourcecred/issues/1163
        const aa = await loadAnalysisAdapter();
        const commitAddr = toRaw({type: "COMMIT", hash: "1234"});
        expect(aa.createdAt(commitAddr)).toEqual(null);
      });
      it("throws an error for an invalid NodeAddress", async () => {
        const aa = await loadAnalysisAdapter();
        expect(() => aa.createdAt(NodeAddress.empty)).toThrowError(
          "Bad address"
        );
      });
    });
  });
});
