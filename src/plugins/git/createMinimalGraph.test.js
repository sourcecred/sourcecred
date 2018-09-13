// @flow

import cloneDeep from "lodash.clonedeep";

import {createMinimalGraph} from "./createMinimalGraph";
import {GraphView} from "./graphView";
import {Prefix as NodePrefix} from "./nodes";
import {Prefix as EdgePrefix} from "./edges";
import {NodeAddress, EdgeAddress} from "../../core/graph";

const makeData = () => cloneDeep(require("./example/example-git"));

describe("plugins/git/createMinimalGraph", () => {
  describe("createMinimalGraph", () => {
    it("processes a simple repository", () => {
      expect(createMinimalGraph(makeData())).toMatchSnapshot();
    });

    it("satisfies the GraphView invariants", () => {
      const graph = createMinimalGraph(makeData());
      expect(() => new GraphView(graph)).not.toThrow();
    });

    it("only has commit nodes and has_parent edges", () => {
      const graph = createMinimalGraph(makeData());
      for (const n of graph.nodes()) {
        if (!NodeAddress.hasPrefix(n, NodePrefix.commit)) {
          throw new Error("Found non-commit node");
        }
      }
      for (const {address} of graph.edges()) {
        if (!EdgeAddress.hasPrefix(address, EdgePrefix.hasParent)) {
          throw new Error("Found non-has-parent edge");
        }
      }
    });
  });
});
