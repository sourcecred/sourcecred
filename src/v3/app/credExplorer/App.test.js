// @flow
import React from "react";
import {shallow} from "enzyme";

import {pagerank} from "../../core/attribution/pagerank";
import App from "./App";

import {Graph, NodeAddress, EdgeAddress} from "../../core/graph";

require("../testUtil").configureEnzyme();
require("../testUtil").configureAphrodite();

function example() {
  const graph = new Graph();
  const nodes = {
    fooAlpha: NodeAddress.fromParts(["foo", "a", "1"]),
    fooBeta: NodeAddress.fromParts(["foo", "b", "2"]),
    bar1: NodeAddress.fromParts(["bar", "a", "1"]),
    bar2: NodeAddress.fromParts(["bar", "2"]),
    xox: NodeAddress.fromParts(["xox"]),
    empty: NodeAddress.empty,
  };
  Object.values(nodes).forEach((n) => graph.addNode((n: any)));

  function addEdge(parts, src, dst) {
    const edge = {address: EdgeAddress.fromParts(parts), src, dst};
    graph.addEdge(edge);
  }

  addEdge(["a"], nodes.fooAlpha, nodes.fooBeta);
  addEdge(["b"], nodes.fooAlpha, nodes.bar1);
  addEdge(["c"], nodes.fooAlpha, nodes.xox);
  addEdge(["d"], nodes.bar1, nodes.bar1);
  addEdge(["e"], nodes.bar1, nodes.xox);
  addEdge(["e'"], nodes.bar1, nodes.xox);

  const adapters = [
    {
      name: () => "foo",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => ({
        nodeDescription: (x) => `foo: ${NodeAddress.toString(x)}`,
      }),
      nodePrefix: () => NodeAddress.fromParts(["foo"]),
      nodeTypes: () => [
        {name: "alpha", prefix: NodeAddress.fromParts(["foo", "a"])},
        {name: "beta", prefix: NodeAddress.fromParts(["foo", "b"])},
      ],
    },
    {
      name: () => "bar",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => ({
        nodeDescription: (x) => `bar: ${NodeAddress.toString(x)}`,
      }),
      nodePrefix: () => NodeAddress.fromParts(["bar"]),
      nodeTypes: () => [
        {name: "alpha", prefix: NodeAddress.fromParts(["bar", "a"])},
      ],
    },
    {
      name: () => "xox",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => ({
        nodeDescription: (_unused_arg) => `xox node!`,
      }),
      nodePrefix: () => NodeAddress.fromParts(["xox"]),
      nodeTypes: () => [],
    },
    {
      name: () => "unused",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => {
        throw new Error("Impossible!");
      },
      nodePrefix: () => NodeAddress.fromParts(["unused"]),
      nodeTypes: () => [],
    },
  ];

  const pagerankResult = pagerank(graph, (_unused_Edge) => ({
    toWeight: 1,
    froWeight: 1,
  }));

  return {adapters, nodes, graph, pagerankResult};
}

describe("app/credExplorer/App", () => {
  it("renders with clean state", () => {
    shallow(<App />);
  });
  it("renders with graph and adapters set", () => {
    const app = shallow(<App />);
    const {graph, adapters} = example();
    const data = {graph, adapters, pagerankResult: null};
    app.setState({data});
  });
  it("renders with graph and adapters and pagerankResult", () => {
    const app = shallow(<App />);
    const {graph, adapters, pagerankResult} = example();
    const data = {graph, adapters, pagerankResult};
    app.setState({data});
  });
});
