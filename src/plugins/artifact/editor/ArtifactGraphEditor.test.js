// @flow

import React from "react";
import {shallow} from "enzyme";

import {Graph} from "core/graph";
import {ArtifactGraphEditor} from "./ArtifactGraphEditor";
import {artifactAddress} from "../artifactPlugin";

require("../../../app/testUtil").configureAphrodite();
require("../../../app/testUtil").configureEnzyme();

describe("ArtifactGraphEditor", () => {
  function createComponent(onChange) {
    return (
      <ArtifactGraphEditor
        settings={{
          githubApiToken: "123youdontneedme",
          repoOwner: "sourcecred",
          repoName: "artifact-tests",
        }}
        onChange={onChange}
      />
    );
  }

  it("invokes its callback after mounting, not construction", () => {
    const onChange = jest.fn();
    const component = createComponent(onChange);
    expect(onChange).not.toHaveBeenCalled();
    shallow(component);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("adds an artifact to the list", () => {
    const onChange = jest.fn();
    const element = shallow(createComponent(onChange));
    expect(onChange).toHaveBeenLastCalledWith(new Graph());
    element
      .find("input")
      .simulate("change", {target: {value: "Root artifact!"}});
    expect(onChange).toHaveBeenCalledTimes(1);
    element.find("button").simulate("click");
    expect(
      element.find("td").filterWhere((x) => x.text() === "Root artifact!")
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

  it("modifies an artifact's description", () => {
    const onChange = jest.fn();
    const element = shallow(createComponent(onChange));
    element
      .find("input")
      .simulate("change", {target: {value: "Root artifact!"}});
    element.find("button").simulate("click");
    element
      .find("tr textarea")
      .simulate("change", {target: {value: "for garlic, carrots, etc."}});
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
          description: "for garlic, carrots, etc.",
        },
      })
    );
  });

  it("does not mutate the graph passed to its callback", () => {
    const onChange = jest.fn();
    const element = shallow(createComponent(onChange));
    const g1 = onChange.mock.calls[0][0];
    const g1Copy = g1.copy();
    element
      .find("input")
      .simulate("change", {target: {value: "Root artifact!"}});
    element.find("button").simulate("click");
    expect(onChange).toHaveBeenCalledTimes(2);
    const g2 = onChange.mock.calls[1][0];
    const g2Copy = g2.copy();
    expect(g1.equals(g1Copy)).toBe(true);
    expect(g1.equals(g2)).toBe(false);
    element
      .find("tr textarea")
      .simulate("change", {target: {value: "for garlic, carrots, etc."}});
    expect(onChange).toHaveBeenCalledTimes(3);
    const g3 = onChange.mock.calls[2][0];
    expect(g1.equals(g1Copy)).toBe(true);
    expect(g2.equals(g2Copy)).toBe(true);
    expect(g3.equals(g2)).toBe(false);
  });
});
