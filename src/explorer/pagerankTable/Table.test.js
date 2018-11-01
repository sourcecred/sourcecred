// @flow

import React from "react";
import {shallow} from "enzyme";

import {NodeAddress, type NodeAddressT} from "../../core/graph";

import {PagerankTable} from "./Table";
import {example, COLUMNS} from "./sharedTestUtils";
import {NodeRowList} from "./Node";
import {WeightConfig} from "../weights/WeightConfig";
import {defaultWeightsForAdapter} from "../weights/weights";
import {FactorioStaticAdapter} from "../../plugins/demo/appAdapter";

require("../../webutil/testUtil").configureEnzyme();
describe("explorer/pagerankTable/Table", () => {
  describe("PagerankTable", () => {
    async function setup(defaultNodeFilter?: NodeAddressT) {
      const {pnd, adapters, weightedTypes} = await example();
      const onWeightedTypesChange = jest.fn();
      const maxEntriesPerList = 321;
      const element = shallow(
        <PagerankTable
          defaultNodeFilter={defaultNodeFilter}
          weightedTypes={weightedTypes}
          onWeightedTypesChange={onWeightedTypesChange}
          pnd={pnd}
          adapters={adapters}
          maxEntriesPerList={maxEntriesPerList}
        />
      );
      return {pnd, adapters, element, maxEntriesPerList, onWeightedTypesChange};
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
        const {element, onWeightedTypesChange} = await setup();
        let button = findButton(element);
        expect(button.text()).toEqual("Show weight configuration");
        button.simulate("click");
        button = findButton(element);
        expect(button.text()).toEqual("Hide weight configuration");
        expect(button).toHaveLength(1); // Its text changed
        const wc = element.find(WeightConfig);
        expect(wc).toHaveLength(1);
        expect(wc.props().weightedTypes).toBe(
          element.instance().props.weightedTypes
        );
        const wt = defaultWeightsForAdapter(new FactorioStaticAdapter());
        wc.props().onChange(wt);
        expect(onWeightedTypesChange).toHaveBeenCalledWith(wt);
        expect(onWeightedTypesChange).toHaveBeenCalledTimes(1);
      });
      it("which is hidden when the WeightConfig button is pushed twice", async () => {
        const {element} = await setup();
        findButton(element).simulate("click");
        findButton(element).simulate("click");
        let button = findButton(element);
        expect(button.text()).toEqual("Show weight configuration");
        expect(element.find(WeightConfig)).toHaveLength(0);
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
      it("filter defaults to show all if defaultNodeFilter not passed", async () => {
        const {element} = await setup();
        expect(element.state().topLevelFilter).toEqual(NodeAddress.empty);
      });
      it("filter defaults to defaultNodeFilter if available", async () => {
        const filter = NodeAddress.fromParts(["factorio", "inserter"]);
        const {element} = await setup(filter);
        expect(element.state().topLevelFilter).toEqual(filter);
      });
      it("raises an error if defaultNodeFilter doesn't match any node type", async () => {
        const badFilter = NodeAddress.fromParts(["doesn't", "exist"]);
        await expect(setup(badFilter)).rejects.toThrow(
          "invalid defaultNodeFilter"
        );
      });
    });

    describe("creates a NodeRowList", () => {
      it("with the correct SharedProps", async () => {
        const {element, adapters, pnd, maxEntriesPerList} = await setup();
        const nrl = element.find(NodeRowList);
        const expectedSharedProps = {adapters, pnd, maxEntriesPerList};
        expect(nrl.props().sharedProps).toEqual(expectedSharedProps);
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
