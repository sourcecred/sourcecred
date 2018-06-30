// @flow

import cloneDeep from "lodash.clonedeep";

import {
  type BecomesEdge,
  createGraph,
  findBecomesEdges,
  findBecomesEdgesForCommits,
} from "./createGraph";
import {GraphView} from "./graphView";
import type {Hash, Tree} from "./types";

const makeData = () => cloneDeep(require("./example/example-git"));

describe("plugins/git/createGraph", () => {
  describe("createGraph", () => {
    it("processes a simple repository", () => {
      expect(createGraph(makeData())).toMatchSnapshot();
    });

    it("satisfies the GraphView invariants", () => {
      const graph = createGraph(makeData());
      expect(() => new GraphView(graph)).not.toThrow();
    });
  });

  describe("findBecomesEdgesForCommits", () => {
    function fromTrees(
      beforeTree: Hash,
      afterTree: Hash,
      trees: {[Hash]: Tree}
    ): BecomesEdge[] {
      const repo = {
        commits: {
          commit1: {
            hash: "commit1",
            parentHashes: [],
            treeHash: beforeTree,
          },
          commit2: {
            hash: "commit2",
            parentHashes: ["commit1"],
            treeHash: afterTree,
          },
        },
        trees,
      };
      return Array.from(findBecomesEdgesForCommits(repo, "commit2", "commit1"));
    }

    it("works on the example repository", () => {
      const data = makeData();
      const childCommitHash = "69c5aad50eec8f2a0a07c988c3b283a6490eb45b";
      expect(data.commits[childCommitHash]).toEqual(expect.anything());
      expect(data.commits[childCommitHash].parentHashes).toHaveLength(1);
      const parentCommitHash = data.commits[childCommitHash].parentHashes[0];
      expect(
        Array.from(
          findBecomesEdgesForCommits(data, childCommitHash, parentCommitHash)
        )
      ).toMatchSnapshot();
    });

    it("works on empty trees", () => {
      expect(
        fromTrees("tree1", "tree2", {
          tree1: {
            hash: "tree1",
            entries: {},
          },
          tree2: {
            hash: "tree2",
            entries: {},
          },
        })
      ).toEqual([]);
    });

    it("finds differences and non-differences at the root", () => {
      expect(
        fromTrees("tree1", "tree2", {
          tree1: {
            hash: "tree1",
            entries: {
              "color.txt": {
                type: "blob",
                name: "color.txt",
                hash: "blue",
              },
              "number.txt": {
                type: "blob",
                name: "number.txt",
                hash: "twelve",
              },
            },
          },
          tree2: {
            hash: "tree2",
            entries: {
              "color.txt": {
                type: "blob",
                name: "color.txt",
                hash: "yellow",
              },
              "number.txt": {
                type: "blob",
                name: "number.txt",
                hash: "twelve",
              },
            },
          },
        })
      ).toEqual([
        {
          from: {
            tree: "tree1",
            name: "color.txt",
          },
          to: {
            tree: "tree2",
            name: "color.txt",
          },
          path: ["color.txt"],
        },
      ]);
    });

    it("handles cases where files of the same name appear in different trees", () => {
      const result = fromTrees("tree1", "tree2", {
        tree1: {
          hash: "tree1",
          entries: {
            "color.txt": {
              type: "blob",
              name: "color.txt",
              hash: "blue",
            },
            "number.txt": {
              type: "blob",
              name: "number.txt",
              hash: "twelve",
            },
            mirror_universe: {
              type: "tree",
              name: "mirror_universe",
              hash: "eert1",
            },
          },
        },
        eert1: {
          hash: "eert1",
          entries: {
            "color.txt": {
              type: "blob",
              name: "color.txt",
              hash: "eulb",
            },
            "number.txt": {
              type: "blob",
              name: "number.txt",
              hash: "evlewt",
            },
          },
        },
        tree2: {
          hash: "tree2",
          entries: {
            "color.txt": {
              type: "blob",
              name: "color.txt",
              hash: "yellow",
            },
            "number.txt": {
              type: "blob",
              name: "number.txt",
              hash: "twelve",
            },
            mirror_universe: {
              type: "tree",
              name: "mirror_universe",
              hash: "eert2",
            },
          },
        },
        eert2: {
          hash: "eert1",
          entries: {
            "color.txt": {
              type: "blob",
              name: "color.txt",
              hash: "eulb",
            },
            "number.txt": {
              type: "blob",
              name: "number.txt",
              hash: "neetneves",
            },
          },
        },
      });
      const expected = [
        {
          from: {
            tree: "tree1",
            name: "color.txt",
          },
          to: {
            tree: "tree2",
            name: "color.txt",
          },
          path: ["color.txt"],
        },
        {
          from: {
            tree: "eert1",
            name: "number.txt",
          },
          to: {
            tree: "eert2",
            name: "number.txt",
          },
          path: ["mirror_universe", "number.txt"],
        },
        {
          from: {
            tree: "tree1",
            name: "mirror_universe",
          },
          to: {
            tree: "tree2",
            name: "mirror_universe",
          },
          path: ["mirror_universe"],
        },
      ];
      expect(result).toEqual(expect.arrayContaining(expected));
      expect(expected).toEqual(
        expect.arrayContaining((result.slice(): $ReadOnlyArray<mixed>).slice())
      );
    });
  });

  describe("findBecomesEdges", () => {
    it("works on the example repository", () => {
      const data = makeData();
      expect(Array.from(findBecomesEdges(data))).toMatchSnapshot();
    });
  });
});
