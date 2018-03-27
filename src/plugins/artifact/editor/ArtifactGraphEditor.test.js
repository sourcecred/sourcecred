// @flow

import React from "react";
import {shallow} from "enzyme";
import enzymeToJSON from "enzyme-to-json";
import stringify from "json-stable-stringify";

import {Graph} from "../../../core/graph";
import {ArtifactGraphEditor} from "./ArtifactGraphEditor";
import {artifactAddress} from "../artifactPlugin";

require("./testUtil").configureAphrodite();
require("./testUtil").configureEnzyme();

describe("ArtifactGraphEditor", () => {
  it("adds an artifact to the list", () => {
    const onChange = jest.fn();
    const component = (
      <ArtifactGraphEditor
        settings={{
          githubApiToken: "123youdontneedme",
          repoOwner: "sourcecred",
          repoName: "artifact-tests",
        }}
        onChange={onChange}
      />
    );
    expect(onChange).not.toHaveBeenCalled();
    const element = shallow(component);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(new Graph());
    element
      .find("input")
      .simulate("change", {target: {value: "Root artifact!"}});
    expect(onChange).toHaveBeenCalledTimes(1);
    element.find("button").simulate("click");
    expect(
      element.find("li").filterWhere((x) => x.text() === "Root artifact!")
    ).toHaveLength(1);
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(
      new Graph().addNode({
        address: artifactAddress(
          new Graph(),
          "sourcecred",
          "artifact-tests",
          "Root artifact!"
        ),
        payload: {
          name: "Root artifact!",
          description: "",
        },
      })
    );
  });

  it("does not mutate the graph passed to its callback", () => {
    const onChange = jest.fn();
    const component = (
      <ArtifactGraphEditor
        settings={{
          githubApiToken: "123youdontneedme",
          repoOwner: "sourcecred",
          repoName: "artifact-tests",
        }}
        onChange={onChange}
      />
    );
    const element = shallow(component);
    expect(onChange).toHaveBeenCalledTimes(1);
    const g1 = onChange.mock.calls[0][0];
    element
      .find("input")
      .simulate("change", {target: {value: "Root artifact!"}});
    element.find("button").simulate("click");
    expect(onChange).toHaveBeenCalledTimes(2);
    const g2 = onChange.mock.calls[1][0];
    expect(g1.equals(new Graph())).toBe(true);
    expect(g1.equals(g2)).toBe(false);
  });
});
