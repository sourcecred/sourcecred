// @flow

import React from "react";
import {shallow} from "enzyme";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../../util/null";
import {TableRow} from "./TableRow";
import {AggregationRowList} from "./Aggregation";
import {
  MIN_SLIDER,
  MAX_SLIDER,
  sliderToWeight,
  weightToSlider,
} from "../../weights/WeightSlider";

import type {NodeAddressT} from "../../../core/graph";

import {nodeDescription} from "./shared";
import {example} from "./sharedTestUtils";
import {NodeRowList, NodeRow, type NodeRowProps} from "./Node";
import {nodes as factorioNodes} from "../../../plugins/demo/graph";

require("../../../webutil/testUtil").configureEnzyme();

describe("explorer/legacy/pagerankTable/Node", () => {
  describe("NodeRowList", () => {
    function sortedByScore(nodes: $ReadOnlyArray<NodeAddressT>, pnd) {
      return sortBy(nodes, (node) => -NullUtil.get(pnd.get(node)).score);
    }
    async function setup(maxEntriesPerList: number = 123) {
      const {adapters, pnd, sharedProps: changeEntries} = await example();
      const sharedProps = {...changeEntries, maxEntriesPerList};
      const nodes = Array.from(pnd.keys());
      expect(nodes).not.toHaveLength(0);
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
        expect(row.prop("depth")).toEqual(0);
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
    async function setup(props: $Shape<{...NodeRowProps}> | void) {
      props = props || {};
      let {sharedProps} = await example();
      if (props.sharedProps !== null) {
        sharedProps = {...sharedProps, ...props.sharedProps};
      }
      const node = factorioNodes.inserter1.address;
      const component = shallow(
        <NodeRow
          node={NullUtil.orElse(props.node, node)}
          showPadding={NullUtil.orElse(props.showPadding, false)}
          depth={NullUtil.orElse(props.depth, 0)}
          sharedProps={sharedProps}
        />
      );
      const row = component.find(TableRow);
      return {row, node, sharedProps};
    }
    describe("instantiates a TableRow", () => {
      it("with the correct depth", async () => {
        const {row: row0} = await setup({depth: 0});
        expect(row0.props().depth).toBe(0);
        const {row: row1} = await setup({depth: 1});
        expect(row1.props().depth).toBe(1);
      });
      it("with the correct showPadding", async () => {
        const {row: row0} = await setup({showPadding: true});
        expect(row0.props().showPadding).toBe(true);
        const {row: row1} = await setup({showPadding: false});
        expect(row1.props().showPadding).toBe(false);
      });
      it("with the node's score as its cred", async () => {
        const {row, node, sharedProps} = await setup();
        const score = NullUtil.get(sharedProps.pnd.get(node)).score;
        expect(row.props().cred).toBe(score);
      });
      describe("with a weight slider", () => {
        async function setupSlider(initialWeight: number = 0) {
          const node = factorioNodes.inserter1.address;
          const manualWeights = new Map([[node, initialWeight]]);
          const partialSharedProps: any = {manualWeights};
          const {row, sharedProps} = await setup({
            sharedProps: partialSharedProps,
          });
          const multiuseColumn = shallow(row.props().multiuseColumn);
          const label = multiuseColumn.find("label");
          const input = label.find("input");
          const span = label.find("span");
          const {onManualWeightsChange} = sharedProps;
          return {
            onManualWeightsChange,
            manualWeights,
            input,
            span,
            node,
            label,
          };
        }
        it("which consists of a range input and span within a label", async () => {
          const {label, input, span} = await setupSlider();
          expect(label).toHaveLength(1);
          expect(input).toHaveLength(1);
          expect(input.props().type).toEqual("range");
          expect(span).toHaveLength(1);
        });
        it("whose onChange triggers onManualWeightsChange", async () => {
          const {node, input, onManualWeightsChange} = await setupSlider();
          expect(onManualWeightsChange).toHaveBeenCalledTimes(0);
          input.simulate("change", {target: {valueAsNumber: MIN_SLIDER}});
          expect(onManualWeightsChange).toHaveBeenLastCalledWith(
            node,
            sliderToWeight(MIN_SLIDER)
          );
          input.simulate("change", {target: {valueAsNumber: MAX_SLIDER}});
          expect(onManualWeightsChange).toHaveBeenLastCalledWith(
            node,
            sliderToWeight(MAX_SLIDER)
          );
          expect(onManualWeightsChange).toHaveBeenCalledTimes(2);
        });
        it("which encodes the weight in slider position", async () => {
          const {input} = await setupSlider(4);
          expect(input.props().value).toEqual(weightToSlider(4));
        });
        it("which prints the weight in text format", async () => {
          const {span} = await setupSlider(4);
          expect(span.text()).toEqual("4×");
        });
      });
      it("with the node description", async () => {
        const {row, sharedProps, node} = await setup();
        const {adapters} = sharedProps;
        const description = shallow(row.props().description);
        expect(description.text()).toEqual(nodeDescription(node, adapters));
      });
      describe("with a AggregationRowList as children", () => {
        function getChildren(row) {
          const children = row.props().children;
          return shallow(children).instance();
        }
        it("which is a AggregationRowList", async () => {
          const {row} = await setup();
          expect(getChildren(row)).toBeInstanceOf(AggregationRowList);
        });
        it("which has the same depth", async () => {
          const {row} = await setup({depth: 13});
          const crl = getChildren(row);
          expect(crl.props.depth).toBe(13);
        });
        it("which has the node as its node", async () => {
          const {row, node} = await setup();
          expect(getChildren(row).props.node).toBe(node);
        });
        it("which has the right sharedProps", async () => {
          const {row, sharedProps} = await setup();
          expect(getChildren(row).props.sharedProps).toBe(sharedProps);
        });
      });
    });
  });
});
