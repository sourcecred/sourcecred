// @flow

import {GraphView} from "./graphView";
import {exampleGraph} from "./example/example";

describe("plugins/github/createGraph", () => {
  it("example graph matches snapshot", () => {
    expect(exampleGraph()).toMatchSnapshot();
  });

  it("passes all GraphView invariants", () => {
    const view = new GraphView(exampleGraph());
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
