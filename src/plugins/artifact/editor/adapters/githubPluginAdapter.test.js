// @flow

import React from "react";
import {shallow} from "enzyme";
import enzymeToJSON from "enzyme-to-json";
import stringify from "json-stable-stringify";

import {parse} from "@/plugins/github/parser";
import exampleRepoData from "@/plugins/github/demoData/example-github.json";
import adapter from "./githubPluginAdapter";

require("../../../../app/testUtil").configureEnzyme();

describe("githubPluginAdapter", () => {
  it("operates on the example repo", () => {
    const graph = parse(exampleRepoData);

    const result = graph
      .nodes()
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
