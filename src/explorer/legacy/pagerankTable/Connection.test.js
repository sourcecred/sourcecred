// @flow

import React from "react";
import {shallow} from "enzyme";
import * as NullUtil from "../../../util/null";

import type {Connection} from "../../../core/algorithm/graphToMarkovChain";
import {ConnectionRowList, ConnectionRow, ConnectionView} from "./Connection";
import {example} from "./sharedTestUtils";
import {TableRow} from "./TableRow";
import {NodeRow} from "./Node";
import {nodes as factorioNodes} from "../../../plugins/demo/graph";

require("../../../webutil/testUtil").configureEnzyme();

describe("explorer/legacy/pagerankTable/Connection", () => {
  describe("ConnectionRowList", () => {
    async function setup(maxEntriesPerList: number = 123) {
      let {sharedProps} = await example();
      sharedProps = {...sharedProps, maxEntriesPerList};
      const depth = 2;
      const node = factorioNodes.inserter1.address;
      const connections = NullUtil.get(sharedProps.pnd.get(node))
        .scoredConnections;
      const component = (
        <ConnectionRowList
          depth={depth}
          node={node}
          sharedProps={sharedProps}
          connections={connections}
        />
      );
      const element = shallow(component);
      return {element, depth, node, sharedProps};
    }
    it("creates `ConnectionRow`s with the right props", async () => {
      const {element, depth, node, sharedProps} = await setup();
      const connections = NullUtil.get(sharedProps.pnd.get(node))
        .scoredConnections;
      const rows = element.find("ConnectionRow");
      expect(rows).toHaveLength(connections.length);
      const rowPropses = rows.map((row) => row.props());
      // Order should be the same as the order in the decomposition.
      expect(rowPropses).toEqual(
        connections.map((sc) => ({
          depth,
          sharedProps,
          target: node,
          scoredConnection: sc,
        }))
      );
    });
    it("limits the number of rows by `maxEntriesPerList`", async () => {
      const maxEntriesPerList = 1;
      const {element, node, sharedProps} = await setup(maxEntriesPerList);
      const connections = NullUtil.get(sharedProps.pnd.get(node))
        .scoredConnections;
      expect(connections.length).toBeGreaterThan(maxEntriesPerList);
      const rows = element.find("ConnectionRow");
      expect(rows).toHaveLength(maxEntriesPerList);
      const rowConnections = rows.map((row) => row.prop("scoredConnection"));
      // Should have selected the right nodes.
      expect(rowConnections).toEqual(connections.slice(0, maxEntriesPerList));
    });
  });

  describe("ConnectionRow", () => {
    async function setup() {
      const {pnd, sharedProps} = await example();
      const target = factorioNodes.inserter1.address;
      const {scoredConnections} = NullUtil.get(pnd.get(target));
      const scoredConnection = scoredConnections[0];
      const depth = 2;
      const component = (
        <ConnectionRow
          depth={depth}
          target={target}
          scoredConnection={scoredConnection}
          sharedProps={sharedProps}
        />
      );
      const row = shallow(component).find(TableRow);
      return {row, depth, target, scoredConnection, sharedProps};
    }
    describe("instantiates a TableRow", () => {
      it("with the correct depth", async () => {
        const {row, depth} = await setup();
        expect(row.props().depth).toBe(depth);
      });
      it("with indent=2", async () => {
        const {row} = await setup();
        expect(row.props().indent).toBe(2);
      });
      it("with showPadding=false", async () => {
        const {row} = await setup();
        expect(row.props().showPadding).toBe(false);
      });
      it("with the connection score as its cred", async () => {
        const {row, scoredConnection} = await setup();
        expect(row.props().cred).toBe(scoredConnection.connectionScore);
      });
      it("with the connectionProportion in the multiuseColumn", async () => {
        const {row, target, scoredConnection, sharedProps} = await setup();
        const targetScore = NullUtil.get(sharedProps.pnd.get(target)).score;
        const expectedPercent =
          ((scoredConnection.connectionScore * 100) / targetScore).toFixed(2) +
          "%";
        expect(row.props().multiuseColumn).toBe(expectedPercent);
      });
      it("with a ConnectionView as description", async () => {
        const {row, scoredConnection} = await setup();
        const description = row.props().description;
        const cv = shallow(description).instance();
        expect(cv).toBeInstanceOf(ConnectionView);
        expect(cv.props.connection).toEqual(scoredConnection.connection);
      });
      describe("with a NodeRow as children", () => {
        function getChildren(row) {
          const children = row.props().children;
          return shallow(children).instance();
        }
        it("which is a NodeRow", async () => {
          const {row} = await setup();
          expect(getChildren(row)).toBeInstanceOf(NodeRow);
        });
        it("which has incremented depth", async () => {
          const {row, depth} = await setup();
          expect(getChildren(row).props.depth).toBe(depth + 1);
        });
        it("which has padding", async () => {
          const {row} = await setup();
          expect(getChildren(row).props.showPadding).toBe(true);
        });
        it("which has the connection source as its node target", async () => {
          const {row, scoredConnection} = await setup();
          expect(getChildren(row).props.node).toBe(scoredConnection.source);
        });
        it("which has the right sharedProps", async () => {
          const {row, sharedProps} = await setup();
          expect(getChildren(row).props.sharedProps).toBe(sharedProps);
        });
      });
    });
  });
  describe("ConnectionView", () => {
    async function setup() {
      const {pnd, sharedProps} = await example();
      const {scoredConnections} = NullUtil.get(
        pnd.get(factorioNodes.machine1.address)
      );
      const connections = scoredConnections.map((sc) => sc.connection);
      function connectionByType(t) {
        return NullUtil.get(
          connections.filter((c) => c.adjacency.type === t)[0],
          `Couldn't find connection for type ${t}`
        );
      }
      const inConnection = connectionByType("IN_EDGE");
      const outConnection = connectionByType("OUT_EDGE");
      const syntheticConnection = connectionByType("SYNTHETIC_LOOP");
      function cvForConnection(connection: Connection) {
        return shallow(
          <ConnectionView
            graph={sharedProps.graph}
            declarations={sharedProps.declarations}
            connection={connection}
          />
        );
      }
      return {
        connections,
        pnd,
        cvForConnection,
        inConnection,
        outConnection,
        syntheticConnection,
      };
    }
    it("always renders exactly one `Badge`", async () => {
      const {
        cvForConnection,
        inConnection,
        outConnection,
        syntheticConnection,
      } = await setup();
      for (const connection of [
        syntheticConnection,
        inConnection,
        outConnection,
      ]) {
        expect(cvForConnection(connection).find("Badge")).toHaveLength(1);
      }
    });
    it("for inward connections, renders a `Badge` and description", async () => {
      const {cvForConnection, inConnection} = await setup();
      const view = cvForConnection(inConnection);
      const outerSpan = view.find("span").first();
      const badge = outerSpan.find("Badge");
      expect(badge.children().text()).toEqual("is transported by");
    });
    it("for outward connections, renders a `Badge` and description", async () => {
      const {cvForConnection, outConnection} = await setup();
      const view = cvForConnection(outConnection);
      const outerSpan = view.find("span").first();
      const badge = outerSpan.find("Badge");
      expect(badge.children().text()).toEqual("assembles");
    });
    it("for synthetic connections, renders only a `Badge`", async () => {
      const {cvForConnection, syntheticConnection} = await setup();
      const view = cvForConnection(syntheticConnection);
      expect(view.find("span")).toHaveLength(0);
      expect(view.find("Badge").children().text()).toEqual("synthetic loop");
    });
  });
});
