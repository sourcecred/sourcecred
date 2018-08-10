// @flow

import React from "react";
import {shallow} from "enzyme";
import * as NullUtil from "../../../util/null";

import type {Connection} from "../../../core/attribution/graphToMarkovChain";
import {ConnectionRowList, ConnectionRow, ConnectionView} from "./Connection";
import {example, COLUMNS} from "./sharedTestUtils";

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
      const connection = alphaConnections[0];
      const {source} = connection;
      const depth = 2;
      const component = (
        <ConnectionRow
          depth={depth}
          target={target}
          scoredConnection={connection}
          sharedProps={sharedProps}
        />
      );
      const element = shallow(component);
      return {element, depth, target, source, connection, sharedProps};
    }
    it("renders the right number of columns", async () => {
      expect((await setup()).element.find("td")).toHaveLength(COLUMNS().length);
    });
    it("has proper depth-based styling", async () => {
      const {element} = await setup();
      expect({
        buttonStyle: element.find("button").prop("style"),
        trStyle: element.find("tr").prop("style"),
      }).toMatchSnapshot();
    });
    it("renders the source view", async () => {
      const {element, sharedProps, connection} = await setup();
      const descriptionColumn = COLUMNS().indexOf("Description");
      expect(descriptionColumn).not.toEqual(-1);
      const view = element
        .find("td")
        .at(descriptionColumn)
        .find("ConnectionView");
      expect(view).toHaveLength(1);
      expect(view.props()).toEqual({
        adapters: sharedProps.adapters,
        connection: connection.connection,
      });
    });
    it("renders the connection percentage", async () => {
      const {element, connection, sharedProps, target} = await setup();
      const connectionColumn = COLUMNS().indexOf("Connection");
      expect(connectionColumn).not.toEqual(-1);
      const proportion =
        connection.connectionScore /
        NullUtil.get(sharedProps.pnd.get(target)).score;
      expect(proportion).toBeGreaterThan(0.0);
      expect(proportion).toBeLessThan(1.0);
      const expectedText = (proportion * 100).toFixed(2) + "%";
      expect(
        element
          .find("td")
          .at(connectionColumn)
          .text()
      ).toEqual(expectedText);
    });
    it("renders a score column with the source's score", async () => {
      const {element, connection} = await setup();
      const expectedScore = connection.sourceScore.toFixed(2);
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
      expect(element.find("ConnectionRowList")).toHaveLength(0);
    });
    it('has a working "expand" button', async () => {
      const {element, depth, sharedProps, source} = await setup();
      expect(element.find("button").text()).toEqual("+");

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("\u2212");
      const crl = element.find("ConnectionRowList");
      expect(crl).toHaveLength(1);
      expect(crl).not.toHaveLength(0);
      expect(crl.prop("sharedProps")).toEqual(sharedProps);
      expect(crl.prop("depth")).toBe(depth + 1);
      expect(crl.prop("node")).toBe(source);

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("+");
      expect(element.find("ConnectionRowList")).toHaveLength(0);
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
