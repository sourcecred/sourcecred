// @flow

import {Graph} from "../../core/graph";
import {graphToTypedArrayMarkovChain} from "./basicPagerank";

describe("graphToMarkovChain", () => {
  it("is correct for a trivial one-node chain", () => {
    const g = new Graph();
    g.addNode({
      address: {
        pluginName: "the magnificent foo plugin",
        type: "irrelevant!",
        id: "who are you blah blah",
      },
      payload: "yes",
    });
    expect(graphToTypedArrayMarkovChain(g)).toMatchSnapshot();
  });
});
