// @flow

import React from "react";
import {shallow} from "enzyme";
import enzymeToJSON from "enzyme-to-json";
import stringify from "json-stable-stringify";

import {GithubParser} from "../../../github/parser";
import exampleRepoData from "../../../github/demoData/example-repo.json";
import adapter from "./githubPluginAdapter";

require("../testUtil").configureEnzyme();

describe("githubPluginAdapter", () => {
  it("operates on the example repo", () => {
    const parser = new GithubParser("sourcecred/example-repo");
    parser.addData(exampleRepoData);
    const graph = parser.graph;

    const result = graph
      .getNodes()
      .map((node) => ({
        id: node.address.id,
        payload: node.payload,
        type: node.address.type,
        title: adapter.extractTitle(graph, node),
        rendered: enzymeToJSON(
          shallow(<adapter.renderer graph={graph} node={node} />)
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
