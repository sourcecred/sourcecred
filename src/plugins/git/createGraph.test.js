// @flow

import cloneDeep from "lodash.clonedeep";

import {createGraph} from "./createGraph";
import {Prefix as NodePrefix} from "./nodes";
import {Prefix as EdgePrefix} from "./edges";
import {NodeAddress, EdgeAddress} from "../../core/graph";

const makeData = () => cloneDeep(require("./example/example-git"));

// Disabled while the Git plugin is inactive
describe.skip("plugins/git/createGraph", () => {
  describe("createGraph", () => {
    it("processes a simple repository", () => {
      expect(createGraph(makeData())).toMatchSnapshot();
    });

    it("only has commit nodes and has_parent edges", () => {
      const graph = createGraph(makeData());
      for (const {address} of graph.nodes()) {
        if (!NodeAddress.hasPrefix(address, NodePrefix.commit)) {
          throw new Error("Found non-commit node");
        }
      }
      for (const {address} of graph.edges({showDangling: true})) {
        if (!EdgeAddress.hasPrefix(address, EdgePrefix.hasParent)) {
          throw new Error("Found non-has-parent edge");
        }
      }
    });
  });
});
