// @flow

import {createGraph} from "./createGraph";
import {GraphView} from "./graphView";
import {RelationalView} from "./relationalView";
import type {GithubResponseJSON} from "./graphql";
import cloneDeep from "lodash.clonedeep";

function exampleGraph() {
  const data: GithubResponseJSON = cloneDeep(
    require("./demoData/example-github")
  );
  const view = new RelationalView(data);
  return createGraph(view);
}

describe("plugins/github/createGraph", () => {
  it("example graph matches snapshot", () => {
    expect(exampleGraph()).toMatchSnapshot();
  });

  it("passes all GraphView invariants", () => {
    const graph = exampleGraph();
    const view = new GraphView(graph);
    // This test is high leverage. It checks:
    // - that every node starting with a GitHub prefix
    //   - can be structured using fromRaw
    //   - has the correct type
    // - that every edge starting with a GitHub prefix
    //   - can be structured using fromRaw
    //   - and has the correct type,
    //   - and that its src has an expected prefix,
    //   - and that its dst has an expected prefix,
    // - that every child node
    //   - has exactly one parent
    //   - has a parent with the correct type
    view.checkInvariants();
    // as currently written, GV checks invariants on construction.
    // we call the method explicitly as a defensive step.
  });
});
