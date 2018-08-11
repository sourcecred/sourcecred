// @flow

import React from "react";
import {shallow} from "enzyme";
import * as NullUtil from "../../../util/null";

import type {Connection} from "../../../core/attribution/graphToMarkovChain";
import {ConnectionRowList, ConnectionRow, ConnectionView} from "./Connection";
import {example} from "./sharedTestUtils";
import {TableRow} from "./TableRow";

require("../../testUtil").configureEnzyme();

describe("app/credExplorer/pagerankTable/Connection", () => {
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

  describe("ConnectionRowList", () => {
    async function setup(maxEntriesPerList: number = 100000) {
      const {adapters, pnd, nodes} = await example();
      const depth = 2;
      const node = nodes.bar1;
      const sharedProps = {adapters, pnd, maxEntriesPerList};
      const component = (
        <ConnectionRowList
          depth={depth}
          node={node}
          sharedProps={sharedProps}
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
      const {pnd, adapters, nodes} = await example();
      const sharedProps = {adapters, pnd, maxEntriesPerList: 123};
      const target = nodes.bar1;
      const {scoredConnections} = NullUtil.get(pnd.get(target));
      const alphaConnections = scoredConnections.filter(
        (sc) => sc.source === nodes.fooAlpha
      );
      expect(alphaConnections).toHaveLength(1);
      const scoredConnection = alphaConnections[0];
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
      it("with the sourceScore", async () => {
        const {row, scoredConnection} = await setup();
        expect(row.props().score).toBe(scoredConnection.sourceScore);
      });
      it("with the connectionProportion", async () => {
        const {row, target, scoredConnection, sharedProps} = await setup();
        const targetScore = NullUtil.get(sharedProps.pnd.get(target)).score;
        expect(row.props().connectionProportion).toBe(
          scoredConnection.connectionScore / targetScore
        );
      });
      it("with a ConnectionView as description", async () => {
        const {row, sharedProps, scoredConnection} = await setup();
        const {adapters} = sharedProps;
        const description = row.props().description;
        const cv = shallow(description).instance();
        expect(cv).toBeInstanceOf(ConnectionView);
        expect(cv.props.connection).toEqual(scoredConnection.connection);
        expect(cv.props.adapters).toEqual(adapters);
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
        it("which has incremented depth", async () => {
          const {row, depth} = await setup();
          expect(getChildren(row).props.depth).toBe(depth + 1);
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
      const {pnd, adapters, nodes} = await example();
      const {scoredConnections} = NullUtil.get(pnd.get(nodes.bar1));
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
          <ConnectionView adapters={adapters} connection={connection} />
        );
      }
      return {
        adapters,
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
      const description = outerSpan.children().find("span");
      expect(badge.children().text()).toEqual("is barred by");
      expect(description.text()).toEqual('bar: NodeAddress["bar","a","1"]');
    });
    it("for outward connections, renders a `Badge` and description", async () => {
      const {cvForConnection, outConnection} = await setup();
      const view = cvForConnection(outConnection);
      const outerSpan = view.find("span").first();
      const badge = outerSpan.find("Badge");
      const description = outerSpan.children().find("span");
      expect(badge.children().text()).toEqual("bars");
      expect(description.text()).toEqual("xox node!");
    });
    it("for synthetic connections, renders only a `Badge`", async () => {
      const {cvForConnection, syntheticConnection} = await setup();
      const view = cvForConnection(syntheticConnection);
      expect(view.find("span")).toHaveLength(0);
      expect(
        view
          .find("Badge")
          .children()
          .text()
      ).toEqual("synthetic loop");
    });
  });
});
