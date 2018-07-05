// @flow
import React from "react";
import {mount, shallow} from "enzyme";
import enzymeToJSON from "enzyme-to-json";

import {PagerankTable, nodeDescription, neighborVerb} from "./PagerankTable";
import {pagerank} from "../../core/attribution/pagerank";
import sortBy from "lodash.sortby";

import {
  Graph,
  type NodeAddressT,
  Direction,
  NodeAddress,
  EdgeAddress,
} from "../../core/graph";

require("../testUtil").configureEnzyme();

function example() {
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

  const adapters = [
    {
      name: () => "foo",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => ({
        nodeDescription: (x) => `foo: ${NodeAddress.toString(x)}`,
        edgeVerb: (_unused_e, direction) =>
          direction === "FORWARD" ? "foos" : "is fooed by",
      }),
      nodePrefix: () => NodeAddress.fromParts(["foo"]),
      edgePrefix: () => EdgeAddress.fromParts(["foo"]),
      nodeTypes: () => [
        {name: "alpha", prefix: NodeAddress.fromParts(["foo", "a"])},
        {name: "beta", prefix: NodeAddress.fromParts(["foo", "b"])},
      ],
    },
    {
      name: () => "bar",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => ({
        nodeDescription: (x) => `bar: ${NodeAddress.toString(x)}`,
        edgeVerb: (_unused_e, direction) =>
          direction === "FORWARD" ? "bars" : "is barred by",
      }),
      nodePrefix: () => NodeAddress.fromParts(["bar"]),
      edgePrefix: () => EdgeAddress.fromParts(["bar"]),
      nodeTypes: () => [
        {name: "alpha", prefix: NodeAddress.fromParts(["bar", "a"])},
      ],
    },
    {
      name: () => "xox",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => ({
        nodeDescription: (_unused_arg) => `xox node!`,
        edgeVerb: (_unused_e, _unused_direction) => `xox'd`,
      }),
      nodePrefix: () => NodeAddress.fromParts(["xox"]),
      edgePrefix: () => EdgeAddress.fromParts(["xox"]),
      nodeTypes: () => [],
    },
    {
      name: () => "unused",
      graph: () => {
        throw new Error("unused");
      },
      renderer: () => {
        throw new Error("Impossible!");
      },
      nodePrefix: () => NodeAddress.fromParts(["unused"]),
      edgePrefix: () => EdgeAddress.fromParts(["unused"]),
      nodeTypes: () => [],
    },
  ];

  const pagerankResult = pagerank(graph, (_unused_Edge) => ({
    toWeight: 1,
    froWeight: 1,
  }));

  return {adapters, nodes, edges, graph, pagerankResult};
}

describe("app/credExplorer/PagerankTable", () => {
  function verifyNoAdapterWarning() {
    expect(console.warn).toHaveBeenCalledWith("No adapter for NodeAddress[]");
    expect(console.warn).toHaveBeenCalledTimes(1);
    // $ExpectFlowError
    console.warn = jest.fn();
  }
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

  describe("rendering with incomplete props", () => {
    it("renders expected message with null props", () => {
      const element = shallow(
        <PagerankTable pagerankResult={null} graph={null} adapters={null} />
      );
      expect(enzymeToJSON(element)).toMatchSnapshot();
    });
    it("renders with just pagerankResult", () => {
      const {pagerankResult} = example();
      // No snapshot since this should never actually happen
      shallow(
        <PagerankTable
          pagerankResult={pagerankResult}
          graph={null}
          adapters={null}
        />
      );
    });
    it("renders with just graph", () => {
      const {graph} = example();
      // No snapshot since this should never actually happen
      shallow(
        <PagerankTable pagerankResult={null} graph={graph} adapters={null} />
      );
    });
    it("renders with just adapters", () => {
      const {adapters} = example();
      // No snapshot since this should never actually happen
      shallow(
        <PagerankTable pagerankResult={null} graph={null} adapters={adapters} />
      );
    });
    it("renders expected message when there's no pagerank", () => {
      const {graph, adapters} = example();
      const element = shallow(
        <PagerankTable
          pagerankResult={null}
          graph={graph}
          adapters={adapters}
        />
      );
      expect(enzymeToJSON(element)).toMatchSnapshot();
    });
  });

  describe("full rendering", () => {
    function exampleRender() {
      const {nodes, edges, adapters, graph, pagerankResult} = example();
      const element = mount(
        <PagerankTable
          pagerankResult={pagerankResult}
          graph={graph}
          adapters={adapters}
        />
      );
      verifyNoAdapterWarning();
      const select = element.find("select");
      expect(select).toHaveLength(1);
      return {nodes, edges, adapters, graph, pagerankResult, element, select};
    }
    it("full render doesn't crash or error", () => {
      example();
    });

    describe("tables", () => {
      function expectColumnCorrect(
        element: *,
        name: string,
        tdToExpected: (x: *) => string,
        addressToExpected: (NodeAddressT) => string
      ) {
        const header = element.find("th");
        const headerTexts = header.map((x) => x.text());
        const headerIndex = headerTexts.indexOf(name);
        if (headerIndex === -1) {
          throw new Error("Could not find column: " + name);
        }
        const tables = element.find("RecursiveTable");
        const actual = tables.map((x) =>
          tdToExpected(x.find("td").at(headerIndex))
        );
        const expected = tables.map((x) => addressToExpected(x.prop("node")));
        expect(actual).toEqual(expected);
      }
      describe("top-level", () => {
        it("are sorted by score", () => {
          const {element, graph, pagerankResult} = exampleRender();
          const rows = element.find("RecursiveTable");
          expect(rows).toHaveLength(Array.from(graph.nodes()).length);
          const scores = rows.map((x) => pagerankResult.get(x.prop("node")));
          expect(scores.every((x) => x != null)).toBe(true);
          expect(scores).toEqual(sortBy(scores).reverse());
        });
        it("has a node description column", () => {
          const {element, adapters} = exampleRender();
          expectColumnCorrect(
            element,
            "Node",
            (td) => td.find("span").text(),
            (address) => nodeDescription(address, adapters)
          );
          verifyNoAdapterWarning();
        });
        it("has a log score column", () => {
          const {element, pagerankResult} = exampleRender();
          expectColumnCorrect(
            element,
            "log(score)",
            (td) => td.text(),
            (address) => {
              const probability = pagerankResult.get(address);
              if (probability == null) {
                throw new Error(address);
              }
              const modifiedLogScore = Math.log(probability) + 10;
              return modifiedLogScore.toFixed(2);
            }
          );
        });
      });
      describe("sub-tables", () => {
        it("have depth-based styling", () => {
          const {element} = exampleRender();
          const getLevel = (level) => {
            const rt = element.find("RecursiveTable").at(level);
            const button = rt.find("button").first();
            return {rt, button};
          };
          getLevel(0).button.simulate("click");
          getLevel(1).button.simulate("click");
          const f = ({rt, button}) => ({
            row: rt
              .find("tr")
              .first()
              .prop("style"),
            button: button.prop("style"),
          });
          expect([0, 1, 2].map((x) => f(getLevel(x)))).toMatchSnapshot();
        });
        it("display extra information about edges", () => {
          const {element, nodes, graph, adapters} = exampleRender();
          const getLevel = (level) => {
            const rt = element.find("RecursiveTable").at(level);
            const button = rt.find("button").first();
            return {rt, button};
          };
          getLevel(0).button.simulate("click");
          const nt = element.find("NeighborsTables");
          expect(nt).toHaveLength(1);
          const expectedNeighbors = Array.from(
            graph.neighbors(nodes.bar1, {
              direction: Direction.ANY,
              nodePrefix: NodeAddress.empty,
              edgePrefix: EdgeAddress.empty,
            })
          );
          expect(nt.prop("neighbors")).toEqual(expectedNeighbors);
          const subTables = nt.find("RecursiveTable");
          expect(subTables).toHaveLength(expectedNeighbors.length);
          const actualEdgeVerbs = subTables.map((x) =>
            x
              .find("span")
              .children()
              .find("span")
              .text()
          );
          const expectedEdgeVerbs = subTables.map((x) => {
            const edge = x.prop("edge");
            const node = x.prop("node");
            return neighborVerb({edge, node}, adapters);
          });

          expect(actualEdgeVerbs).toEqual(expectedEdgeVerbs);
          const actualFullDescriptions = subTables.map((x) =>
            x
              .find("span")
              .first()
              .text()
          );
          const expectedFullDescriptions = subTables.map((x) => {
            const edge = x.prop("edge");
            const node = x.prop("node");
            const nd = nodeDescription(node, adapters);
            const ev = neighborVerb({node, edge}, adapters);
            return `${ev} ${nd}`;
          });
          expect(actualFullDescriptions).toEqual(expectedFullDescriptions);
          expect(actualFullDescriptions).toMatchSnapshot();
        });
      });
      it("button toggles between +/- and adds sub-RecursiveTable", () => {
        const {element} = exampleRender();
        const rt = () => element.find("RecursiveTable").first();
        const button = rt().find("button");
        expect(button).toEqual(expect.anything());
        expect(button.text()).toEqual("+");
        expect(rt().find("NeighborsTables")).toHaveLength(0);

        button.simulate("click");
        expect(button.text()).toEqual("\u2212");
        expect(rt().find("NeighborsTables")).toHaveLength(1);

        button.simulate("click");
        expect(button.text()).toEqual("+");
        expect(rt().find("NeighborsTables")).toHaveLength(0);
      });
    });

    describe("filter selector", () => {
      it("has the correct options", () => {
        const {select} = exampleRender();
        const options = select.children();
        expect(options.every("option")).toBe(true);
        const results = options.map((x) => ({
          valueString: NodeAddress.toString(x.prop("value")),
          style: x.prop("style"),
          text: x.text(),
        }));
        expect(results).toMatchSnapshot();
      });

      function selectFilterByName(select, name) {
        const option = select.children().filterWhere((x) => x.text() === name);
        if (option.length !== 1) {
          throw new Error(`ambiguous select, got ${option.length} options`);
        }
        const value = option.prop("value");
        select.simulate("change", {target: {value}});
      }
      it("plugin-level filter with no nodes works", () => {
        const {select, element} = exampleRender();
        expect(element.find("tbody tr")).not.toHaveLength(0);
        selectFilterByName(select, "unused");
        expect(element.find("tbody tr")).toHaveLength(0);
      });
      it("type-level filter with some nodes works", () => {
        const {select, element} = exampleRender();
        selectFilterByName(select, "\u2003beta");
        const rt = element.find("RecursiveTable");
        expect(rt).toHaveLength(1);
        expect(rt.prop("node")).toEqual(example().nodes.fooBeta);
      });
      it("filter doesn't apply to sub-tables", () => {
        const {select, element} = exampleRender();
        selectFilterByName(select, "\u2003beta");
        const rt = element.find("RecursiveTable");
        expect(rt).toHaveLength(1);
        const button = rt.find("button");
        expect(button).toHaveLength(1);
        button.simulate("click");

        const rts = element.find("RecursiveTable");
        expect(rts).toHaveLength(2);
        const subRt = rts.last();
        expect(subRt.prop("node")).toEqual(example().nodes.fooAlpha);
      });
    });
  });
});
