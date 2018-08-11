// @flow

import React from "react";
import {shallow} from "enzyme";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../../util/null";

import {type NodeAddressT, NodeAddress} from "../../../core/graph";

import {ConnectionRowList} from "./Connection";
import {example, COLUMNS} from "./sharedTestUtils";
import {NodeRowList, NodeRow} from "./Node";

require("../../testUtil").configureEnzyme();

describe("app/credExplorer/pagerankTable/Node", () => {
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
  describe("NodeRowList", () => {
    function sortedByScore(nodes: $ReadOnlyArray<NodeAddressT>, pnd) {
      return sortBy(nodes, (node) => -NullUtil.get(pnd.get(node)).score);
    }
    async function setup(maxEntriesPerList: number = 100000) {
      const {adapters, pnd} = await example();
      const nodes = sortedByScore(Array.from(pnd.keys()), pnd)
        .reverse() // ascending order!
        .filter((x) =>
          NodeAddress.hasPrefix(x, NodeAddress.fromParts(["foo"]))
        );
      expect(nodes).not.toHaveLength(0);
      expect(nodes).not.toHaveLength(1);
      expect(nodes).not.toHaveLength(pnd.size);
      const sharedProps = {adapters, pnd, maxEntriesPerList};
      const component = <NodeRowList sharedProps={sharedProps} nodes={nodes} />;
      const element = shallow(component);
      return {element, adapters, sharedProps, nodes};
    }
    it("creates `NodeRow`s with the right props", async () => {
      const {element, nodes, sharedProps} = await setup();
      const rows = element.find("NodeRow");
      expect(rows).toHaveLength(nodes.length);
      const rowNodes = rows.map((row) => row.prop("node"));
      // Check that we selected the right set of nodes. We'll check
      // order in a separate test case.
      expect(rowNodes.slice().sort()).toEqual(nodes.slice().sort());
      rows.forEach((row) => {
        expect(row.prop("sharedProps")).toEqual(sharedProps);
      });
    });
    it("creates up to `maxEntriesPerList` `NodeRow`s", async () => {
      const maxEntriesPerList = 1;
      const {element, nodes, sharedProps} = await setup(maxEntriesPerList);
      expect(nodes.length).toBeGreaterThan(maxEntriesPerList);
      const rows = element.find("NodeRow");
      expect(rows).toHaveLength(maxEntriesPerList);
      const rowNodes = rows.map((row) => row.prop("node"));
      // Should have selected the right nodes.
      expect(rowNodes).toEqual(
        sortedByScore(nodes, sharedProps.pnd).slice(0, maxEntriesPerList)
      );
    });
    it("sorts its children by score", async () => {
      const {
        element,
        nodes,
        sharedProps: {pnd},
      } = await setup();
      expect(nodes).not.toEqual(sortedByScore(nodes, pnd));
      const rows = element.find("NodeRow");
      const rowNodes = rows.map((row) => row.prop("node"));
      expect(rowNodes).toEqual(sortedByScore(rowNodes, pnd));
    });
  });

  describe("NodeRow", () => {
    async function setup() {
      const {pnd, adapters, nodes} = await example();
      const sharedProps = {adapters, pnd, maxEntriesPerList: 123};
      const node = nodes.bar1;
      const component = <NodeRow node={node} sharedProps={sharedProps} />;
      const element = shallow(component);
      return {element, node, sharedProps};
    }
    it("renders the right number of columns", async () => {
      expect((await setup()).element.find("td")).toHaveLength(COLUMNS().length);
    });
    it("renders the node description", async () => {
      const {element} = await setup();
      const expectedDescription = 'bar: NodeAddress["bar","a","1"]';
      const descriptionColumn = COLUMNS().indexOf("Description");
      expect(descriptionColumn).not.toEqual(-1);
      expect(
        element
          .find("td")
          .at(descriptionColumn)
          .find("span")
          .text()
      ).toEqual(expectedDescription);
    });
    it("renders an empty connection column", async () => {
      const {element} = await setup();
      const connectionColumn = COLUMNS().indexOf("Connection");
      expect(connectionColumn).not.toEqual(-1);
      expect(
        element
          .find("td")
          .at(connectionColumn)
          .text()
      ).toEqual("—");
    });
    it("renders a score column with the node's score", async () => {
      const {element, sharedProps, node} = await setup();
      const {score} = NullUtil.get(sharedProps.pnd.get(node));
      const expectedScore = score.toFixed(2);
      const connectionColumn = COLUMNS().indexOf("Score");
      expect(connectionColumn).not.toEqual(-1);
      expect(
        element
          .find("td")
          .at(connectionColumn)
          .text()
      ).toEqual(expectedScore);
    });
    it("does not render children by default", async () => {
      const {element} = await setup();
      expect(element.find(ConnectionRowList)).toHaveLength(0);
    });
    it('has a working "expand" button', async () => {
      const {element, sharedProps, node} = await setup();
      expect(element.find("button").text()).toEqual("+");
      expect(element.state().expanded).toBe(false);

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("\u2212");
      expect(element.find(ConnectionRowList)).toHaveLength(1);
      expect(element.state().expanded).toBe(true);

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("+");
      expect(element.find(ConnectionRowList)).toHaveLength(0);
      expect(element.state().expanded).toBe(false);
    });
    it("child ConnectionRowList has correct props", async () => {
      const {element, sharedProps, node} = await setup();
      element.setState({expanded: true});
      const crl = element.find(ConnectionRowList);
      const props = crl.props();
      expect(props.colorDepth).toBe(1);
      expect(props.indentDepth).toBe(1);
      expect(props.sharedProps).toBe(sharedProps);
      expect(props.node).toBe(node);
      expect(crl.props().sharedProps).toBe(sharedProps);
      expect(crl.props().node).toBe(source);
    });
  });
});
