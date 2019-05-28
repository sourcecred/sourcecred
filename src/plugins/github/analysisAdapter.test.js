// @flow

import fs from "fs-extra";
import path from "path";
import pako from "pako";
import {BackendAdapterLoader} from "./analysisAdapter";
import {stringToRepoId} from "../../core/repoId";
import {declaration} from "./declaration";
import {RelationalView} from "./relationalView";
import {createGraph} from "./createGraph";
import {NodeAddress} from "../../core/graph";
import {toRaw} from "./nodes";

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
    describe("has a createdAt method which", () => {
      it("provides createdAt times", async () => {
        const aa = await loadAnalysisAdapter();
        const addr = toRaw({
          type: "ISSUE",
          repo: {type: "REPO", owner: "sourcecred", name: "example-github"},
          number: "1",
        });
        const actualCreatedAt = aa.createdAt(addr);
        expect(actualCreatedAt).toMatchInlineSnapshot(`1519807088000`);
      });
      it("throws an error for an absent entity", async () => {
        const aa = await loadAnalysisAdapter();
        const addr = toRaw({
          type: "ISSUE",
          repo: {type: "REPO", owner: "sourcecred", name: "example-github"},
          number: "1001",
        });
        expect(() => aa.createdAt(addr)).toThrowError("No entity matching");
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
