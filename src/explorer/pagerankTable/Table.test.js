// @flow

import React from "react";
import {shallow} from "enzyme";

import {NodeAddress} from "../../core/graph";

import {PagerankTable} from "./Table";
import {example, COLUMNS} from "./sharedTestUtils";
import {NodeRowList} from "./Node";
import {WeightConfig} from "../weights/WeightConfig";
import {type NodeType} from "../../analysis/types";

require("../../webutil/testUtil").configureEnzyme();
describe("explorer/pagerankTable/Table", () => {
  describe("PagerankTable", () => {
    async function setup(defaultNodeType?: NodeType) {
      const {
        pnd,
        adapters,
        sharedProps,
        manualWeights,
        onManualWeightsChange,
        weightConfig,
        maxEntriesPerList,
      } = await example();
      const element = shallow(
        <PagerankTable
          defaultNodeType={defaultNodeType}
          weightConfig={weightConfig}
          pnd={pnd}
          adapters={adapters}
          maxEntriesPerList={maxEntriesPerList}
          manualWeights={manualWeights}
          onManualWeightsChange={onManualWeightsChange}
        />
      );
      return {
        pnd,
        adapters,
        element,
        maxEntriesPerList,
        weightConfig,
        onManualWeightsChange,
        manualWeights,
        sharedProps,
      };
    }
    it("renders thead column order properly", async () => {
      const {element} = await setup();
      const th = element.find("thead th");
      const columnNames = th.map((t) => t.text());
      expect(columnNames).toEqual(COLUMNS());
    });

    describe("has a WeightConfig", () => {
      function findButton(element) {
        const button = element
          .findWhere(
            (x) =>
              x.text() === "Show weight configuration" ||
              x.text() === "Hide weight configuration"
          )
          .find("button");
        expect(button).toHaveLength(1);
        return button;
      }
      it("which is not present by default", async () => {
        const {element} = await setup();
        expect(element.find(WeightConfig)).toHaveLength(0);
        const button = findButton(element);
        expect(button.text()).toEqual("Show weight configuration");
      });
      it("which is present when the WeightConfig button is pushed", async () => {
        const {element} = await setup();
        let button = findButton(element);
        expect(button.text()).toEqual("Show weight configuration");
        button.simulate("click");
        button = findButton(element);
        expect(button.text()).toEqual("Hide weight configuration");
        expect(button).toHaveLength(1); // Its text changed
        expect(element.find({"data-test-weight-config": true})).toHaveLength(1);
      });
      it("which is hidden when the WeightConfig button is pushed twice", async () => {
        const {element} = await setup();
        findButton(element).simulate("click");
        findButton(element).simulate("click");
        let button = findButton(element);
        expect(button.text()).toEqual("Show weight configuration");
        expect(element.find({"data-test-weight-config": true})).toHaveLength(0);
      });
    });

    describe("has a filter select", () => {
      it("with expected label text", async () => {
        const {element} = await setup();
        const label = element.find("label");
        const filterText = label
          .find("span")
          .first()
          .text();
        expect(filterText).toMatchSnapshot();
      });
      it("with expected option groups", async () => {
        const {element} = await setup();
        const label = element.find("label");
        const options = label.find("option");
        const optionsJSON = options.map((o) => ({
          valueString: NodeAddress.toString(o.prop("value")),
          style: o.prop("style"),
          text: o.text(),
        }));
        expect(optionsJSON).toMatchSnapshot();
      });
      it("with the ability to filter nodes passed to NodeRowList", async () => {
        const {element} = await setup();
        const label = element.find("label");
        const options = label.find("option");
        const option = options.at(2);

        const value = option.prop("value");
        expect(value).not.toEqual(NodeAddress.empty);
        const previousNodes = element.find("NodeRowList").prop("nodes");
        expect(
          previousNodes.every((n) => NodeAddress.hasPrefix(n, value))
        ).toBe(false);
        element.find("select").simulate("change", {target: {value}});
        const actualNodes = element.find("NodeRowList").prop("nodes");
        expect(actualNodes.every((n) => NodeAddress.hasPrefix(n, value))).toBe(
          true
        );
        expect(actualNodes).not.toHaveLength(0);
      });
      it("filter defaults to show all if defaultNodeType not passed", async () => {
        const {element} = await setup();
        expect(element.state().selectedNodeTypePrefix).toEqual(
          NodeAddress.empty
        );
      });
      it("selectedNodeTypePrefix defaults to provided NodeType, if available", async () => {
        const nodeType: NodeType = {
          name: "testNodeType",
          pluralName: "testNodeTypes",
          prefix: NodeAddress.fromParts(["foo"]),
          defaultWeight: 1,
          description: "test type",
        };
        const {element} = await setup(nodeType);
        expect(element.state().selectedNodeTypePrefix).toEqual(nodeType.prefix);
      });
    });

    describe("creates a NodeRowList", () => {
      it("with the correct SharedProps", async () => {
        const {element, sharedProps} = await setup();
        const nrl = element.find(NodeRowList);
        expect(nrl.props().sharedProps).toEqual(sharedProps);
      });
      it("including all nodes by default", async () => {
        const {element, pnd} = await setup();
        const nrl = element.find(NodeRowList);
        const expectedNodes = Array.from(pnd.keys());
        expect(nrl.props().nodes).toEqual(expectedNodes);
      });
    });
  });
});
