// @flow
import React from "react";
import {shallow} from "enzyme";
import enzymeToJSON from "enzyme-to-json";

import {
  PagerankTable,
  NodeRowList,
  NodeRow,
  ContributionRowList,
  ContributionRow,
  ContributionView,
} from "./PagerankTable";
import {pagerank} from "../../core/attribution/pagerank";
import sortBy from "lodash.sortby";
import {type Contribution} from "../../core/attribution/graphToMarkovChain";
import * as NullUtil from "../../util/null";

import {
  Graph,
  type NodeAddressT,
  NodeAddress,
  EdgeAddress,
} from "../../core/graph";

require("../testUtil").configureEnzyme();

const COLUMNS = () => ["Description", "Contribution", "Score"];

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

  const pnd = pagerank(graph, (_unused_Edge) => ({
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
    it("renders expected message with null props", () => {
      const element = shallow(
        <PagerankTable pnd={null} adapters={null} maxEntriesPerList={1} />
      );
      expect(enzymeToJSON(element)).toMatchSnapshot();
    });
    it("renders expected message with just adapters", () => {
      const {adapters} = example();
      const element = shallow(
        <PagerankTable pnd={null} adapters={adapters} maxEntriesPerList={1} />
      );
      expect(enzymeToJSON(element)).toMatchSnapshot();
    });
    it("throws an error if maxEntriesPerList not set", () => {
      const {pnd, adapters} = example();
      expect(() =>
        shallow(
          <PagerankTable
            pnd={pnd}
            adapters={adapters}
            // $ExpectFlowError
            maxEntriesPerList={null}
          />
        )
      ).toThrowError("maxEntriesPerList");
    });
    it("renders thead column order properly", () => {
      const {pnd, adapters} = example();
      const element = shallow(
        <PagerankTable pnd={pnd} adapters={adapters} maxEntriesPerList={1} />
      );
      const th = element.find("thead th");
      const columnNames = th.map((t) => t.text());
      expect(columnNames).toEqual(COLUMNS());
    });

    describe("has a filter select", () => {
      function setup() {
        const {pnd, adapters} = example();
        const element = shallow(
          <PagerankTable pnd={pnd} adapters={adapters} maxEntriesPerList={1} />
        );
        const label = element.find("label");
        const options = label.find("option");
        return {pnd, adapters, element, label, options};
      }
      it("with expected label text", () => {
        const {label} = setup();
        const filterText = label
          .find("span")
          .first()
          .text();
        expect(filterText).toMatchSnapshot();
      });
      it("with expected option groups", () => {
        const {options} = setup();
        const optionsJSON = options.map((o) => ({
          valueString: NodeAddress.toString(o.prop("value")),
          style: o.prop("style"),
          text: o.text(),
        }));
        expect(optionsJSON).toMatchSnapshot();
      });
      it("with the ability to filter nodes passed to NodeRowList", () => {
        const {element, options} = setup();
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
      function setup() {
        const {adapters, pnd} = example();
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
      it("with the correct SharedProps", () => {
        const {nrl, adapters, pnd, maxEntriesPerList} = setup();
        const expectedSharedProps = {adapters, pnd, maxEntriesPerList};
        expect(nrl.prop("sharedProps")).toEqual(expectedSharedProps);
      });
      it("including all nodes by default", () => {
        const {nrl, pnd} = setup();
        const expectedNodes = Array.from(pnd.keys());
        expect(nrl.prop("nodes")).toEqual(expectedNodes);
      });
    });
  });

  describe("NodeRowList", () => {
    function sortedByScore(nodes: $ReadOnlyArray<NodeAddressT>, pnd) {
      return sortBy(nodes, (node) => -NullUtil.get(pnd.get(node)).score);
    }
    function setup(maxEntriesPerList: number = 100000) {
      const {adapters, pnd} = example();
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
    it("creates `NodeRow`s with the right props", () => {
      const {element, nodes, sharedProps} = setup();
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
    it("creates up to `maxEntriesPerList` `NodeRow`s", () => {
      const maxEntriesPerList = 1;
      const {element, nodes, sharedProps} = setup(maxEntriesPerList);
      expect(nodes.length).toBeGreaterThan(maxEntriesPerList);
      const rows = element.find("NodeRow");
      expect(rows).toHaveLength(maxEntriesPerList);
      const rowNodes = rows.map((row) => row.prop("node"));
      // Should have selected the right nodes.
      expect(rowNodes).toEqual(
        sortedByScore(nodes, sharedProps.pnd).slice(0, maxEntriesPerList)
      );
    });
    it("sorts its children by score", () => {
      const {
        element,
        nodes,
        sharedProps: {pnd},
      } = setup();
      expect(nodes).not.toEqual(sortedByScore(nodes, pnd));
      const rows = element.find("NodeRow");
      const rowNodes = rows.map((row) => row.prop("node"));
      expect(rowNodes).toEqual(sortedByScore(rowNodes, pnd));
    });
  });

  describe("NodeRow", () => {
    function setup() {
      const {pnd, adapters, nodes} = example();
      const sharedProps = {adapters, pnd, maxEntriesPerList: 123};
      const node = nodes.bar1;
      const component = <NodeRow node={node} sharedProps={sharedProps} />;
      const element = shallow(component);
      return {element, node, sharedProps};
    }
    it("renders the right number of columns", () => {
      expect(setup().element.find("td")).toHaveLength(COLUMNS().length);
    });
    it("renders the node description", () => {
      const {element} = setup();
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
    it("renders an empty contribution column", () => {
      const {element} = setup();
      const contributionColumn = COLUMNS().indexOf("Contribution");
      expect(contributionColumn).not.toEqual(-1);
      expect(
        element
          .find("td")
          .at(contributionColumn)
          .text()
      ).toEqual("—");
    });
    it("renders a score column with the node's log-score", () => {
      const {element, sharedProps, node} = setup();
      const {score: rawScore} = NullUtil.get(sharedProps.pnd.get(node));
      const expectedScore = (Math.log(rawScore) + 10).toFixed(2);
      const contributionColumn = COLUMNS().indexOf("Score");
      expect(contributionColumn).not.toEqual(-1);
      expect(
        element
          .find("td")
          .at(contributionColumn)
          .text()
      ).toEqual(expectedScore);
    });
    it("does not render children by default", () => {
      const {element} = setup();
      expect(element.find("ContributionRowList")).toHaveLength(0);
    });
    it('has a working "expand" button', () => {
      const {element, sharedProps, node} = setup();
      expect(element.find("button").text()).toEqual("+");

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("\u2212");
      const crl = element.find("ContributionRowList");
      expect(crl).toHaveLength(1);
      expect(crl.prop("sharedProps")).toEqual(sharedProps);
      expect(crl.prop("depth")).toBe(1);
      expect(crl.prop("node")).toBe(node);

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("+");
      expect(element.find("ContributionRowList")).toHaveLength(0);
    });
  });

  describe("ContributionRowList", () => {
    function setup(maxEntriesPerList: number = 100000) {
      const {adapters, pnd, nodes} = example();
      const depth = 2;
      const node = nodes.bar1;
      const sharedProps = {adapters, pnd, maxEntriesPerList};
      const component = (
        <ContributionRowList
          depth={depth}
          node={node}
          sharedProps={sharedProps}
        />
      );
      const element = shallow(component);
      return {element, depth, node, sharedProps};
    }
    it("creates `ContributionRow`s with the right props", () => {
      const {element, depth, node, sharedProps} = setup();
      const contributions = NullUtil.get(sharedProps.pnd.get(node))
        .scoredContributions;
      const rows = element.find("ContributionRow");
      expect(rows).toHaveLength(contributions.length);
      const rowPropses = rows.map((row) => row.props());
      // Order should be the same as the order in the decomposition.
      expect(rowPropses).toEqual(
        contributions.map((sc) => ({
          depth,
          sharedProps,
          target: node,
          scoredContribution: sc,
        }))
      );
    });
    it("limits the number of rows by `maxEntriesPerList`", () => {
      const maxEntriesPerList = 1;
      const {element, node, sharedProps} = setup(maxEntriesPerList);
      const contributions = NullUtil.get(sharedProps.pnd.get(node))
        .scoredContributions;
      expect(contributions.length).toBeGreaterThan(maxEntriesPerList);
      const rows = element.find("ContributionRow");
      expect(rows).toHaveLength(maxEntriesPerList);
      const rowContributions = rows.map((row) =>
        row.prop("scoredContribution")
      );
      // Should have selected the right nodes.
      expect(rowContributions).toEqual(
        contributions.slice(0, maxEntriesPerList)
      );
    });
  });

  describe("ContributionRow", () => {
    function setup() {
      const {pnd, adapters, nodes} = example();
      const sharedProps = {adapters, pnd, maxEntriesPerList: 123};
      const target = nodes.bar1;
      const {scoredContributions} = NullUtil.get(pnd.get(target));
      const alphaContributions = scoredContributions.filter(
        (sc) => sc.source === nodes.fooAlpha
      );
      expect(alphaContributions).toHaveLength(1);
      const contribution = alphaContributions[0];
      const {source} = contribution;
      const depth = 2;
      const component = (
        <ContributionRow
          depth={depth}
          target={target}
          scoredContribution={contribution}
          sharedProps={sharedProps}
        />
      );
      const element = shallow(component);
      return {element, depth, target, source, contribution, sharedProps};
    }
    it("renders the right number of columns", () => {
      expect(setup().element.find("td")).toHaveLength(COLUMNS().length);
    });
    it("has proper depth-based styling", () => {
      const {element} = setup();
      expect({
        buttonStyle: element.find("button").prop("style"),
        trStyle: element.find("tr").prop("style"),
      }).toMatchSnapshot();
    });
    it("renders the source view", () => {
      const {element, sharedProps, contribution} = setup();
      const descriptionColumn = COLUMNS().indexOf("Description");
      expect(descriptionColumn).not.toEqual(-1);
      const view = element
        .find("td")
        .at(descriptionColumn)
        .find("ContributionView");
      expect(view).toHaveLength(1);
      expect(view.props()).toEqual({
        adapters: sharedProps.adapters,
        contribution: contribution.contribution,
      });
    });
    it("renders the contribution percentage", () => {
      const {element, contribution, sharedProps, target} = setup();
      const contributionColumn = COLUMNS().indexOf("Contribution");
      expect(contributionColumn).not.toEqual(-1);
      const proportion =
        contribution.contributionScore /
        NullUtil.get(sharedProps.pnd.get(target)).score;
      expect(proportion).toBeGreaterThan(0.0);
      expect(proportion).toBeLessThan(1.0);
      const expectedText = (proportion * 100).toFixed(2) + "%";
      expect(
        element
          .find("td")
          .at(contributionColumn)
          .text()
      ).toEqual(expectedText);
    });
    it("renders a score column with the source's log-score", () => {
      const {element, contribution} = setup();
      const expectedScore = (Math.log(contribution.sourceScore) + 10).toFixed(
        2
      );
      const contributionColumn = COLUMNS().indexOf("Score");
      expect(contributionColumn).not.toEqual(-1);
      expect(
        element
          .find("td")
          .at(contributionColumn)
          .text()
      ).toEqual(expectedScore);
    });
    it("does not render children by default", () => {
      const {element} = setup();
      expect(element.find("ContributionRowList")).toHaveLength(0);
    });
    it('has a working "expand" button', () => {
      const {element, depth, sharedProps, source} = setup();
      expect(element.find("button").text()).toEqual("+");

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("\u2212");
      const crl = element.find("ContributionRowList");
      expect(crl).toHaveLength(1);
      expect(crl).not.toHaveLength(0);
      expect(crl.prop("sharedProps")).toEqual(sharedProps);
      expect(crl.prop("depth")).toBe(depth + 1);
      expect(crl.prop("node")).toBe(source);

      element.find("button").simulate("click");
      expect(element.find("button").text()).toEqual("+");
      expect(element.find("ContributionRowList")).toHaveLength(0);
    });
  });

  describe("ContributionView", () => {
    function setup() {
      const {pnd, adapters, nodes} = example();
      const {scoredContributions} = NullUtil.get(pnd.get(nodes.bar1));
      const contributions = scoredContributions.map((sc) => sc.contribution);
      function contributionByType(t) {
        return NullUtil.get(
          contributions.filter((c) => c.contributor.type === t)[0],
          `Couldn't find contribution for type ${t}`
        );
      }
      const inContribution = contributionByType("IN_EDGE");
      const outContribution = contributionByType("OUT_EDGE");
      const syntheticContribution = contributionByType("SYNTHETIC_LOOP");
      function cvForContribution(contribution: Contribution) {
        return shallow(
          <ContributionView adapters={adapters} contribution={contribution} />
        );
      }
      return {
        adapters,
        contributions,
        pnd,
        cvForContribution,
        inContribution,
        outContribution,
        syntheticContribution,
      };
    }
    it("always renders exactly one `Badge`", () => {
      const {
        cvForContribution,
        inContribution,
        outContribution,
        syntheticContribution,
      } = setup();
      for (const contribution of [
        syntheticContribution,
        inContribution,
        outContribution,
      ]) {
        expect(cvForContribution(contribution).find("Badge")).toHaveLength(1);
      }
    });
    it("for inward contributions, renders a `Badge` and description", () => {
      const {cvForContribution, inContribution} = setup();
      const view = cvForContribution(inContribution);
      const outerSpan = view.find("span").first();
      const badge = outerSpan.find("Badge");
      const description = outerSpan.children().find("span");
      expect(badge.children().text()).toEqual("is barred by");
      expect(description.text()).toEqual('bar: NodeAddress["bar","a","1"]');
    });
    it("for outward contributions, renders a `Badge` and description", () => {
      const {cvForContribution, outContribution} = setup();
      const view = cvForContribution(outContribution);
      const outerSpan = view.find("span").first();
      const badge = outerSpan.find("Badge");
      const description = outerSpan.children().find("span");
      expect(badge.children().text()).toEqual("bars");
      expect(description.text()).toEqual("xox node!");
    });
    it("for synthetic contributions, renders only a `Badge`", () => {
      const {cvForContribution, syntheticContribution} = setup();
      const view = cvForContribution(syntheticContribution);
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
