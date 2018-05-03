// @flow

import cloneDeep from "lodash.clonedeep";

import {createGraph} from "./createGraph";
import {
  BLOB_NODE_TYPE,
  COMMIT_NODE_TYPE,
  GIT_PLUGIN_NAME,
  HAS_CONTENTS_EDGE_TYPE,
  HAS_PARENT_EDGE_TYPE,
  HAS_TREE_EDGE_TYPE,
  INCLUDES_EDGE_TYPE,
  SUBMODULE_COMMIT_NODE_TYPE,
  TREE_ENTRY_NODE_TYPE,
  TREE_NODE_TYPE,
  treeEntryId,
} from "./types";

const makeData = () => cloneDeep(require("./demoData/example-git"));

describe("createGraph", () => {
  it("processes a simple repository", () => {
    expect(createGraph(makeData())).toMatchSnapshot();
  });

  it("has no dangling edges", () => {
    const graph = createGraph(makeData());
    graph.edges().forEach((edge) => {
      expect(graph.node(edge.src)).toEqual(expect.anything());
      expect(graph.node(edge.dst)).toEqual(expect.anything());
    });
  });

  it("has all commits, each with correct edges", () => {
    const data = makeData();
    const graph = createGraph(data);
    Object.keys(data.commits).forEach((hash) => {
      const address = {
        pluginName: GIT_PLUGIN_NAME,
        type: COMMIT_NODE_TYPE,
        id: hash,
      };
      expect(graph.node(address)).toEqual({address, payload: {}});
      expect(
        graph.neighborhood(address, {
          nodeType: TREE_NODE_TYPE,
          edgeType: HAS_TREE_EDGE_TYPE,
        })
      ).toHaveLength(1);
      expect(
        graph.neighborhood(address, {
          nodeType: COMMIT_NODE_TYPE,
          edgeType: HAS_PARENT_EDGE_TYPE,
          direction: "OUT",
        })
      ).toHaveLength(data.commits[hash].parentHashes.length);
      expect(graph.neighborhood(address, {direction: "OUT"})).toHaveLength(
        1 + data.commits[hash].parentHashes.length
      );
    });
  });

  it("has all trees, each with correct edges", () => {
    const data = makeData();
    const graph = createGraph(data);
    Object.keys(data.trees).forEach((hash) => {
      const address = {
        pluginName: GIT_PLUGIN_NAME,
        type: TREE_NODE_TYPE,
        id: hash,
      };

      const entryChildren = graph.neighborhood(address, {
        nodeType: TREE_ENTRY_NODE_TYPE,
        edgeType: INCLUDES_EDGE_TYPE,
        direction: "OUT",
      });
      expect(entryChildren).toHaveLength(
        Object.keys(data.trees[hash].entries).length
      );
      expect(graph.neighborhood(address, {direction: "OUT"})).toHaveLength(
        entryChildren.length
      );

      expect(graph.node(address)).toEqual({address, payload: {}});
      const owningCommits = graph.neighborhood(address, {
        nodeType: COMMIT_NODE_TYPE,
        edgeType: HAS_TREE_EDGE_TYPE,
        direction: "IN",
      });
      expect(owningCommits.length).toBeLessThanOrEqual(1);
      const parentTreeEntries = graph.neighborhood(address, {
        nodeType: TREE_ENTRY_NODE_TYPE,
        edgeType: HAS_CONTENTS_EDGE_TYPE,
        direction: "IN",
      });
      expect(graph.neighborhood(address, {direction: "IN"})).toHaveLength(
        owningCommits.length + parentTreeEntries.length
      );
    });
  });

  it("has all tree entries, each with correct edges", () => {
    const data = makeData();
    const graph = createGraph(data);
    Object.keys(data.trees).forEach((hash) => {
      const tree = data.trees[hash];
      const treeAddress = {
        pluginName: GIT_PLUGIN_NAME,
        type: TREE_NODE_TYPE,
        id: hash,
      };
      expect(graph.node(treeAddress)).toEqual({
        address: treeAddress,
        payload: {},
      });
      Object.keys(tree.entries).forEach((name) => {
        const entryAddress = {
          pluginName: GIT_PLUGIN_NAME,
          type: TREE_ENTRY_NODE_TYPE,
          id: treeEntryId(hash, name),
        };
        expect(
          graph.neighborhood(entryAddress, {
            nodeType: TREE_NODE_TYPE,
            edgeType: INCLUDES_EDGE_TYPE,
            direction: "IN",
          })
        ).toHaveLength(1);
        // Note: this may fail if the test database is changed such that
        // a submodule has multiple potential URLs (or none at all).
        // Currently, each submodule has exactly one potential URL.
        expect(
          graph.neighborhood(entryAddress, {
            edgeType: HAS_CONTENTS_EDGE_TYPE,
            direction: "OUT",
          })
        ).toHaveLength(1);
        expect(graph.neighborhood(entryAddress)).toHaveLength(2);
      });
    });
  });

  describe("has specific paths:", () => {
    const headCommitHash = "3715ddfb8d4c4fd2a6f6af75488c82f84c92ec2f";
    if (makeData().commits[headCommitHash] == null) {
      throw new Error("Commit hash out of date.");
    }

    function uniqueNeighborMatching(
      graph,
      nodeAddress,
      filter?,
      predicate = (_) => true
    ) {
      const edges = graph
        .neighborhood(nodeAddress, filter)
        .filter((x) => predicate(x));
      expect(edges).toHaveLength(1);
      return edges[0].neighbor;
    }

    function uniqueTree(graph, commitAddress) {
      return uniqueNeighborMatching(graph, commitAddress, {
        nodeType: TREE_NODE_TYPE,
        edgeType: HAS_TREE_EDGE_TYPE,
      });
    }

    function uniqueEntry(graph, treeAddress, entryName: string) {
      return uniqueNeighborMatching(
        graph,
        treeAddress,
        {
          nodeType: TREE_ENTRY_NODE_TYPE,
          edgeType: INCLUDES_EDGE_TYPE,
        },
        ({edge}) => edge.address.id.endsWith(`:${entryName}`)
      );
    }

    function uniqueContents(graph, treeEntryNodeAddress) {
      return uniqueNeighborMatching(graph, treeEntryNodeAddress, {
        edgeType: HAS_CONTENTS_EDGE_TYPE,
      });
    }

    test("HEAD^{tree}:src/quantum_gravity.py with correct contents", () => {
      const data = makeData();
      const graph = createGraph(data);

      const headCommitAddress = {
        pluginName: GIT_PLUGIN_NAME,
        type: COMMIT_NODE_TYPE,
        id: headCommitHash,
      };
      const headTreeAddress = uniqueTree(graph, headCommitAddress);
      const srcTreeEntryAddress = uniqueEntry(graph, headTreeAddress, "src");
      const srcTreeAddress = uniqueContents(graph, srcTreeEntryAddress);
      const blobEntryAddress = uniqueEntry(
        graph,
        srcTreeAddress,
        "quantum_gravity.py"
      );
      const blobAddress = uniqueContents(graph, blobEntryAddress);
      expect(graph.node(blobAddress)).toEqual(
        expect.objectContaining({
          address: expect.objectContaining({
            type: BLOB_NODE_TYPE,
            id: "aea4f28abb23abde151b0ead4063227f8bf6c0b0",
          }),
        })
      );
    });

    test("HEAD^{tree}:pygravitydefier with no contents", () => {
      const data = makeData();
      const graph = createGraph(data);

      const headCommitAddress = {
        pluginName: GIT_PLUGIN_NAME,
        type: COMMIT_NODE_TYPE,
        id: headCommitHash,
      };
      const headTreeAddress = uniqueTree(graph, headCommitAddress);
      const treeEntryAddress = uniqueEntry(
        graph,
        headTreeAddress,
        "pygravitydefier"
      );
      const submoduleCommitAddress = uniqueContents(graph, treeEntryAddress);
      expect(graph.node(submoduleCommitAddress)).toEqual(
        expect.objectContaining({
          address: expect.objectContaining({type: SUBMODULE_COMMIT_NODE_TYPE}),
          payload: expect.objectContaining({
            url: expect.stringMatching(/https:.*example-git-submodule/),
          }),
        })
      );
    });
  });
});
