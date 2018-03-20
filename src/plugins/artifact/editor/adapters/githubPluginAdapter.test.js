// @flow

import React from "react";
import reactTestRenderer from "react-test-renderer";
import stringify from "json-stable-stringify";

import type {NodeID} from "../../../github/githubPlugin";
import {GithubParser} from "../../../github/githubPlugin";
import exampleRepoData from "../../../github/demoData/example-repo.json";
import adapter from "./githubPluginAdapter";

describe("githubPluginAdapter", () => {
  it("operates on the example repo", () => {
    const parser = new GithubParser("sourcecred/example-repo");
    parser.addData(exampleRepoData.data);
    const graph = parser.graph;

    const result = graph
      .getAllNodes()
      .map((node) => ({
        id: (JSON.parse(node.address.id): NodeID),
        payload: node.payload,
        type: adapter.extractType(graph, node),
        title: adapter.extractTitle(graph, node),
        rendered: reactTestRenderer.create(
          <adapter.renderer graph={graph} node={node} />
        ),
      }))
      .sort((a, b) => {
        const ka = stringify(a.id);
        const kb = stringify(b.id);
        return ka > kb ? 1 : ka < kb ? -1 : 0;
      });
    expect(result).toMatchSnapshot();
  });
});
