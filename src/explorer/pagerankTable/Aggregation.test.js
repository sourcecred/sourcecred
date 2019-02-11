// @flow

import React from "react";
import {shallow} from "enzyme";

import * as NullUtil from "../../util/null";
import {NodeAddress, EdgeAddress} from "../../core/graph";
import type {EdgeType, NodeType} from "../../analysis/types";
import {
  AggregationRowList,
  AggregationRow,
  AggregationView,
} from "./Aggregation";
import {ConnectionRowList} from "./Connection";
import {Badge} from "./shared";
import {example} from "./sharedTestUtils";
import {aggregateFlat, type FlatAggregation} from "./aggregate";
import {TableRow} from "./TableRow";
import {nodes as factorioNodes} from "../../plugins/demo/graph";

require("../../webutil/testUtil").configureEnzyme();

describe("explorer/pagerankTable/Aggregation", () => {
  describe("AggregationRowList", () => {
    it("instantiates AggregationRows for each aggregation", async () => {
      const {adapters, pnd} = await example();
      const node = factorioNodes.inserter1;
      const depth = 20;
      const maxEntriesPerList = 50;
      const sharedProps = {adapters, pnd, maxEntriesPerList};
      const connections = NullUtil.get(pnd.get(node)).scoredConnections;
      const aggregations = aggregateFlat(
        connections,
        adapters.static().nodeTypes(),
        adapters.static().edgeTypes()
      );
      const el = shallow(
        <AggregationRowList
          depth={depth}
          node={node}
          sharedProps={sharedProps}
        />
      );
      const aggregationRows = el.children(AggregationRow);
      expect(aggregationRows).toHaveLength(aggregations.length);

      for (let i = 0; i < aggregations.length; i++) {
        const aggregationRow = aggregationRows.at(i);
        const props = aggregationRow.props();
        expect(props.depth).toEqual(depth);
        expect(props.target).toEqual(node);
        expect(props.sharedProps).toEqual(sharedProps);
        expect(props.aggregation).toEqual(aggregations[i]);
        i++;
      }
    });
  });

  describe("AggregationRow", () => {
    async function setup() {
      const {pnd, adapters} = await example();
      const sharedProps = {adapters, pnd, maxEntriesPerList: 123};
      const target = factorioNodes.inserter1;
      const {scoredConnections} = NullUtil.get(pnd.get(target));
      const aggregations = aggregateFlat(
        scoredConnections,
        adapters.static().nodeTypes(),
        adapters.static().edgeTypes()
      );
      const aggregation = aggregations[0];
      const depth = 23;
      const component = (
        <AggregationRow
          depth={depth}
          target={target}
          aggregation={aggregation}
          sharedProps={sharedProps}
        />
      );
      const element = shallow(component);
      const row = element.find(TableRow);
      return {
        element,
        row,
        depth,
        target,
        aggregation,
        sharedProps,
      };
    }
    describe("instantiates a TableRow", () => {
      it("with the correct depth", async () => {
        const {row, depth} = await setup();
        expect(row.props().depth).toBe(depth);
      });
      it("with indent=1", async () => {
        const {row} = await setup();
        expect(row.props().indent).toBe(1);
      });
      it("with showPadding=false", async () => {
        const {row} = await setup();
        expect(row.props().showPadding).toBe(false);
      });
      it("with the aggregation score as its cred", async () => {
        const {row, aggregation} = await setup();
        expect(row.props().cred).toBe(aggregation.summary.score);
      });
      it("with the aggregation's contribution proportion", async () => {
        const {row, target, aggregation, sharedProps} = await setup();
        const targetScore = NullUtil.get(sharedProps.pnd.get(target)).score;
        expect(row.props().connectionProportion).toBe(
          aggregation.summary.score / targetScore
        );
      });
      it("with a AggregationView as description", async () => {
        const {row, aggregation} = await setup();
        const description = row.props().description;
        const cv = shallow(description).instance();
        expect(cv).toBeInstanceOf(AggregationView);
        expect(cv.props.aggregation).toEqual(aggregation);
      });
      describe("with a ConnectionRowList as children", () => {
        function getChildren(row) {
          const children = row.props().children;
          return shallow(children).instance();
        }
        it("which is a ConnectionRowList", async () => {
          const {row} = await setup();
          expect(getChildren(row)).toBeInstanceOf(ConnectionRowList);
        });
        it("which has the same depth", async () => {
          const {row, depth} = await setup();
          expect(getChildren(row).props.depth).toBe(depth);
        });
        it("which has the aggregation target as its node target", async () => {
          const {row, target} = await setup();
          expect(getChildren(row).props.node).toBe(target);
        });
        it("which has the right sharedProps", async () => {
          const {row, sharedProps} = await setup();
          expect(getChildren(row).props.sharedProps).toBe(sharedProps);
        });
      });
    });
  });
  describe("AggregationView", () => {
    const nodeType: NodeType = {
      name: "whatDoes",
      pluralName: "whatDoth",
      defaultWeight: 1,
      prefix: NodeAddress.empty,
      description: "An example NodeType for testing purposes",
    };
    const edgeType: EdgeType = {
      forwardName: "marsellus",
      backwardName: "wallace",
      defaultForwardWeight: 1,
      defaultBackwardWeight: 1,
      prefix: EdgeAddress.fromParts(["look", "like"]),
      description: "Connects example nodes for testing purposes.",
    };
    function aggView(aggregation: FlatAggregation) {
      const el = shallow(<AggregationView aggregation={aggregation} />);
      const stuff = el.find("span").children();
      const connectionDescription = stuff.at(0);
      expect(connectionDescription.type()).toBe(Badge);
      const summarySize = stuff.at(1);
      expect(summarySize.type()).toBe("span");
      const nodeName = stuff.at(2);
      expect(nodeName.type()).toBe("span");
      return {
        connectionDescription: connectionDescription.props().children,
        summarySize: summarySize.text(),
        nodeName: nodeName.text(),
      };
    }
    it("renders a synthetic connection", () => {
      const synthetic = {
        nodeType,
        connectionType: {type: "SYNTHETIC_LOOP"},
        summary: {size: 1, score: 1},
        connections: [],
      };
      const {connectionDescription, summarySize, nodeName} = aggView(synthetic);
      expect(connectionDescription).toBe("synthetic loop");
      expect(summarySize).toBe(" 1 ");
      expect(nodeName).toBe("whatDoes");
    });
    it("renders an inEdge connection", () => {
      const inEdge = {
        nodeType,
        connectionType: {type: "IN_EDGE", edgeType},
        summary: {size: 2, score: 1},
        connections: [],
      };
      const {connectionDescription, summarySize, nodeName} = aggView(inEdge);
      expect(connectionDescription).toBe("wallace");
      expect(summarySize).toBe(" 2 ");
      expect(nodeName).toBe("whatDoth");
    });
    it("renders an outEdge connection", () => {
      const outEdge = {
        nodeType,
        connectionType: {type: "OUT_EDGE", edgeType},
        summary: {size: 3, score: 1},
        connections: [],
      };
      const {connectionDescription, summarySize, nodeName} = aggView(outEdge);
      expect(connectionDescription).toBe("marsellus");
      expect(summarySize).toBe(" 3 ");
      expect(nodeName).toBe("whatDoth");
    });
    it("does not pluralize connections containing one element", () => {
      const inEdge = {
        nodeType,
        connectionType: {type: "IN_EDGE", edgeType},
        summary: {size: 1, score: 1},
        connections: [],
      };
      const {nodeName} = aggView(inEdge);
      expect(nodeName).toBe("whatDoes");
    });
    it("does pluralize connections containing multiple elements", () => {
      const inEdge = {
        nodeType,
        connectionType: {type: "IN_EDGE", edgeType},
        summary: {size: 2, score: 1},
        connections: [],
      };
      const {nodeName} = aggView(inEdge);
      expect(nodeName).toBe("whatDoth");
    });
  });
});
