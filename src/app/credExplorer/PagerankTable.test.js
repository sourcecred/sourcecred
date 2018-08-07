// @flow
import React from "react";
import {shallow} from "enzyme";

import type {DynamicPluginAdapter} from "../../core/pluginAdapter";

import {
  PagerankTable,
  NodeRowList,
  NodeRow,
  ConnectionRowList,
  ConnectionRow,
  ConnectionView,
} from "./PagerankTable";
import {pagerank} from "../../core/attribution/pagerank";
import sortBy from "lodash.sortby";
import {type Connection} from "../../core/attribution/graphToMarkovChain";
import * as NullUtil from "../../util/null";

import {
  Graph,
  type NodeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../../core/graph";

require("../testUtil").configureEnzyme();

const COLUMNS = () => ["Description", "Connection", "Score"];

async function example() {
  const graph = new Graph();
  const nodes = {
    fooAlpha: NodeAddress.fromParts(["foo", "a", "1"]),
    fooBeta: NodeAddress.fromParts(["foo", "b", "2"]),
    bar1: NodeAddress.fromParts(["bar", "a", "1"]),
    bar2: NodeAddress.fromParts(["bar", "2"]),
    xox: NodeAddress.fromParts(["xox"]),
    empty: NodeAddress.empty,
  };
  Object.values(nodes).forEach((n) => graph.addNode((n: any)));

  function addEdge(parts, src, dst) {
    const edge = {address: EdgeAddress.fromParts(parts), src, dst};
    graph.addEdge(edge);
    return edge;
  }

  const edges = {
    fooA: addEdge(["foo", "a"], nodes.fooAlpha, nodes.fooBeta),
    fooB: addEdge(["foo", "b"], nodes.fooAlpha, nodes.bar1),
    fooC: addEdge(["foo", "c"], nodes.fooAlpha, nodes.xox),
    barD: addEdge(["bar", "d"], nodes.bar1, nodes.bar1),
    barE: addEdge(["bar", "e"], nodes.bar1, nodes.xox),
    barF: addEdge(["bar", "f"], nodes.bar1, nodes.xox),
  };

  const adapters: DynamicPluginAdapter[] = [
    {
      static: () => ({
        name: () => "foo",
        nodePrefix: () => NodeAddress.fromParts(["foo"]),
        edgePrefix: () => EdgeAddress.fromParts(["foo"]),
        nodeTypes: () => [
          {
            name: "alpha",
            prefix: NodeAddress.fromParts(["foo", "a"]),
            defaultWeight: 1,
          },
          {
            name: "beta",
            prefix: NodeAddress.fromParts(["foo", "b"]),
            defaultWeight: 1,
          },
        ],
        edgeTypes: () => [
          {
            prefix: EdgeAddress.fromParts(["foo"]),
            forwardName: "foos",
            backwardName: "is fooed by",
          },
        ],
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: (x) => `foo: ${NodeAddress.toString(x)}`,
    },
    {
      static: () => ({
        name: () => "bar",
        nodePrefix: () => NodeAddress.fromParts(["bar"]),
        edgePrefix: () => EdgeAddress.fromParts(["bar"]),
        nodeTypes: () => [
          {
            name: "alpha",
            prefix: NodeAddress.fromParts(["bar", "a"]),
            defaultWeight: 1,
          },
        ],
        edgeTypes: () => [
          {
            prefix: EdgeAddress.fromParts(["bar"]),
            forwardName: "bars",
            backwardName: "is barred by",
          },
        ],
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: (x) => `bar: ${NodeAddress.toString(x)}`,
    },
    {
      static: () => ({
        name: () => "xox",
        nodePrefix: () => NodeAddress.fromParts(["xox"]),
        edgePrefix: () => EdgeAddress.fromParts(["xox"]),
        nodeTypes: () => [],
        edgeTypes: () => [],
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: (_unused_arg) => `xox node!`,
    },
    {
      static: () => ({
        nodePrefix: () => NodeAddress.fromParts(["unused"]),
        edgePrefix: () => EdgeAddress.fromParts(["unused"]),
        nodeTypes: () => [],
        edgeTypes: () => [],
        name: () => "unused",
        load: (_unused_repo) => {
          throw new Error("unused");
        },
      }),
      graph: () => {
        throw new Error("unused");
      },
      nodeDescription: () => {
        throw new Error("Unused");
      },
    },
  ];

  const pnd = await pagerank(graph, (_unused_Edge) => ({
    toWeight: 1,
    froWeight: 1,
  }));

  return {adapters, nodes, edges, graph, pnd};
}

describe("app/credExplorer/PagerankTable", () => {
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
        <PagerankTable pnd={pnd} adapters={adapters} maxEntriesPerList={1} />
      );
      const th = element.find("thead th");
      const columnNames = th.map((t) => t.text());
      expect(columnNames).toEqual(COLUMNS());
    });

    describe("has a filter select", () => {
      async function setup() {
        const {pnd, adapters} = await example();
        const element = shallow(
          <PagerankTable pnd={pnd} adapters={adapters} maxEntriesPerList={1} />
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
    });

    describe("creates a NodeRowList", () => {
      async function setup() {
        const {adapters, pnd} = await example();
        const maxEntriesPerList = 1;
        const element = shallow(
          <PagerankTable
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
    it("renders a score column with the node's log-score", async () => {
      const {element, sharedProps, node} = await setup();
      const {score: rawScore} = NullUtil.get(sharedProps.pnd.get(node));
      const expectedScore = (-Math.log(rawScore)).toFixed(2);
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
      const {element, sharedProps, node} = await setup();
      expect(element.find("button").text()).toEqual("+");

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("\u2212");
      const crl = element.find("ConnectionRowList");
      expect(crl).toHaveLength(1);
      expect(crl.prop("sharedProps")).toEqual(sharedProps);
      expect(crl.prop("depth")).toBe(1);
      expect(crl.prop("node")).toBe(node);

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("+");
      expect(element.find("ConnectionRowList")).toHaveLength(0);
    });
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
    it("renders a score column with the source's log-score", async () => {
      const {element, connection} = await setup();
      const expectedScore = (-Math.log(connection.sourceScore)).toFixed(2);
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
