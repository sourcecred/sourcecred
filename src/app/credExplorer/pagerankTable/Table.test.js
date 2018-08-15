// @flow

import React from "react";
import {shallow} from "enzyme";

import {NodeAddress, type NodeAddressT} from "../../../core/graph";

import {PagerankTable} from "./Table";
import {example, COLUMNS} from "./sharedTestUtils";

require("../../testUtil").configureEnzyme();
describe("app/credExplorer/pagerankTable/Table", () => {
  beforeEach(() => {
    // $ExpectFlowError
    console.error = jest.fn();
    // $ExpectFlowError
    console.warn = jest.fn();
  });
  afterEach(() => {
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
  });
  describe("PagerankTable", () => {
    it("renders thead column order properly", async () => {
      const {pnd, adapters} = await example();
      const element = shallow(
        <PagerankTable
          defaultNodeFilter={null}
          pnd={pnd}
          adapters={adapters}
          maxEntriesPerList={1}
        />
      );
      const th = element.find("thead th");
      const columnNames = th.map((t) => t.text());
      expect(columnNames).toEqual(COLUMNS());
    });

    describe("has a filter select", () => {
      async function setup(defaultNodeFilter?: NodeAddressT) {
        const {pnd, adapters} = await example();
        const element = shallow(
          <PagerankTable
            defaultNodeFilter={defaultNodeFilter}
            pnd={pnd}
            adapters={adapters}
            maxEntriesPerList={1}
          />
        );
        const label = element.find("label");
        const options = label.find("option");
        return {pnd, adapters, element, label, options};
      }
      it("with expected label text", async () => {
        const {label} = await setup();
        const filterText = label
          .find("span")
          .first()
          .text();
        expect(filterText).toMatchSnapshot();
      });
      it("with expected option groups", async () => {
        const {options} = await setup();
        const optionsJSON = options.map((o) => ({
          valueString: NodeAddress.toString(o.prop("value")),
          style: o.prop("style"),
          text: o.text(),
        }));
        expect(optionsJSON).toMatchSnapshot();
      });
      it("with the ability to filter nodes passed to NodeRowList", async () => {
        const {element, options} = await setup();
        const option1 = options.at(1);
        const value = option1.prop("value");
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
        const filter = NodeAddress.fromParts(["foo", "a"]);
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
      async function setup() {
        const {adapters, pnd} = await example();
        const maxEntriesPerList = 1;
        const element = shallow(
          <PagerankTable
            defaultNodeFilter={null}
            pnd={pnd}
            adapters={adapters}
            maxEntriesPerList={maxEntriesPerList}
          />
        );
        const nrl = element.find("NodeRowList");
        return {adapters, pnd, element, nrl, maxEntriesPerList};
      }
      it("with the correct SharedProps", async () => {
        const {nrl, adapters, pnd, maxEntriesPerList} = await setup();
        const expectedSharedProps = {adapters, pnd, maxEntriesPerList};
        expect(nrl.prop("sharedProps")).toEqual(expectedSharedProps);
      });
      it("including all nodes by default", async () => {
        const {nrl, pnd} = await setup();
        const expectedNodes = Array.from(pnd.keys());
        expect(nrl.prop("nodes")).toEqual(expectedNodes);
      });
    });
  });
});
