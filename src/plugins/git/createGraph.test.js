// @flow

import cloneDeep from "lodash.clonedeep";
import deepEqual from "lodash.isequal";

import {createGraph} from "./createGraph";
import {GIT_PLUGIN_NAME, treeEntryId} from "./types";

const makeData = () => cloneDeep(require("./demoData/example-git"));

describe("createGraph", () => {
  it("processes a simple repository", () => {
    expect(createGraph(makeData(), "sourcecred/example-git")).toMatchSnapshot();
  });

  it("has no dangling edges", () => {
    const graph = createGraph(makeData(), "sourcecred/example-git");
    graph.edges().forEach((edge) => {
      expect(graph.node(edge.src)).toEqual(expect.anything());
      expect(graph.node(edge.dst)).toEqual(expect.anything());
    });
  });

  it("has all commits, each with correct edges", () => {
    const data = makeData();
    const graph = createGraph(data, "sourcecred/example-git");
    Object.keys(data.commits).forEach((hash) => {
      const address = {
        pluginName: GIT_PLUGIN_NAME,
        repositoryName: "sourcecred/example-git",
        type: "COMMIT",
        id: hash,
      };
      expect(graph.node(address)).toEqual({address, payload: {}});
      expect(graph.neighborhood(address)).toHaveLength(1);
      expect(
        graph.neighborhood(address, {nodeType: "TREE", edgeType: "HAS_TREE"})
      ).toHaveLength(1);
    });
  });

  it("has all trees, each with correct edges", () => {
    const data = makeData();
    const graph = createGraph(data, "sourcecred/example-git");
    Object.keys(data.trees).forEach((hash) => {
      const address = {
        pluginName: GIT_PLUGIN_NAME,
        repositoryName: "sourcecred/example-git",
        type: "TREE",
        id: hash,
      };

      const entryChildren = graph.outEdges(address, {
        nodeType: "TREE_ENTRY",
        edgeType: "INCLUDES",
      });
      expect(entryChildren).toHaveLength(
        Object.keys(data.trees[hash].entries).length
      );
      expect(graph.outEdges(address)).toHaveLength(entryChildren.length);

      expect(graph.node(address)).toEqual({address, payload: {}});
      const owningCommits = graph.inEdges(address, {
        nodeType: "COMMIT",
        edgeType: "HAS_TREE",
      });
      expect(owningCommits.length).toBeLessThanOrEqual(1);
      const parentTreeEntries = graph.inEdges(address, {
        nodeType: "TREE_ENTRY",
        edgeType: "HAS_CONTENTS",
      });
      expect(graph.inEdges(address)).toHaveLength(
        owningCommits.length + parentTreeEntries.length
      );
    });
  });

  it("has all tree entries, each with correct edges", () => {
    const data = makeData();
    const graph = createGraph(data, "sourcecred/example-git");
    Object.keys(data.trees).forEach((hash) => {
      const tree = data.trees[hash];
      const treeAddress = {
        pluginName: GIT_PLUGIN_NAME,
        repositoryName: "sourcecred/example-git",
        type: "TREE",
        id: hash,
      };
      Object.keys(tree.entries).forEach((name) => {
        const entryAddress = {
          pluginName: GIT_PLUGIN_NAME,
          repositoryName: "sourcecred/example-git",
          type: "TREE_ENTRY",
          id: treeEntryId(hash, name),
        };
        expect(
          graph.inEdges(entryAddress, {nodeType: "TREE", edgeType: "INCLUDES"})
        ).toHaveLength(1);
        const shouldHaveContents = tree.entries[name].type !== "commit";
        expect(
          graph.outEdges(entryAddress, {edgeType: "HAS_CONTENTS"})
        ).toHaveLength(shouldHaveContents ? 1 : 0);
        expect(graph.neighborhood(entryAddress)).toHaveLength(
          shouldHaveContents ? 2 : 1
        );
      });
    });
  });
});
