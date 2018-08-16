// @flow

import cloneDeep from "lodash.clonedeep";

import {createGraph} from "./createGraph";
import {GraphView} from "./graphView";

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
});
