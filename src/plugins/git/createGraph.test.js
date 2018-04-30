// @flow

import cloneDeep from "lodash.clonedeep";
import deepEqual from "lodash.isequal";

import {createGraph} from "./createGraph";
import {
  COMMIT_NODE_TYPE,
  GIT_PLUGIN_NAME,
  HAS_CONTENTS_EDGE_TYPE,
  HAS_TREE_EDGE_TYPE,
  INCLUDES_EDGE_TYPE,
  TREE_ENTRY_NODE_TYPE,
  TREE_NODE_TYPE,
  treeEntryId,
} from "./types";

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
        type: COMMIT_NODE_TYPE,
        id: hash,
      };
      expect(graph.node(address)).toEqual({address, payload: {}});
      expect(graph.neighborhood(address)).toHaveLength(1);
      expect(
        graph.neighborhood(address, {
          nodeType: TREE_NODE_TYPE,
          edgeType: HAS_TREE_EDGE_TYPE,
        })
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
        type: TREE_NODE_TYPE,
        id: hash,
      };

      const entryChildren = graph.outEdges(address, {
        nodeType: TREE_ENTRY_NODE_TYPE,
        edgeType: INCLUDES_EDGE_TYPE,
      });
      expect(entryChildren).toHaveLength(
        Object.keys(data.trees[hash].entries).length
      );
      expect(graph.outEdges(address)).toHaveLength(entryChildren.length);

      expect(graph.node(address)).toEqual({address, payload: {}});
      const owningCommits = graph.inEdges(address, {
        nodeType: COMMIT_NODE_TYPE,
        edgeType: HAS_TREE_EDGE_TYPE,
      });
      expect(owningCommits.length).toBeLessThanOrEqual(1);
      const parentTreeEntries = graph.inEdges(address, {
        nodeType: TREE_ENTRY_NODE_TYPE,
        edgeType: HAS_CONTENTS_EDGE_TYPE,
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
        type: TREE_NODE_TYPE,
        id: hash,
      };
      Object.keys(tree.entries).forEach((name) => {
        const entryAddress = {
          pluginName: GIT_PLUGIN_NAME,
          repositoryName: "sourcecred/example-git",
          type: TREE_ENTRY_NODE_TYPE,
          id: treeEntryId(hash, name),
        };
        expect(
          graph.inEdges(entryAddress, {
            nodeType: TREE_NODE_TYPE,
            edgeType: INCLUDES_EDGE_TYPE,
          })
        ).toHaveLength(1);
        const shouldHaveContents = tree.entries[name].type !== "commit";
        expect(
          graph.outEdges(entryAddress, {edgeType: HAS_CONTENTS_EDGE_TYPE})
        ).toHaveLength(shouldHaveContents ? 1 : 0);
        expect(graph.neighborhood(entryAddress)).toHaveLength(
          shouldHaveContents ? 2 : 1
        );
      });
    });
  });
});
