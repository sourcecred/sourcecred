// @flow

import deepFreeze from "deep-freeze";
import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import {utcWeek} from "d3-time";
import {
  NodeAddress,
  Graph,
  type NodeAddressT,
  EdgeAddress,
} from "../../core/graph";
import {TimelineCred} from "./timelineCred";
import {type PluginDeclaration} from "../pluginDeclaration";
import {defaultWeights} from "../weights";
import {type NodeType} from "../types";

describe("src/analysis/timeline/timelineCred", () => {
  const userType: NodeType = {
    name: "user",
    pluralName: "users",
    prefix: NodeAddress.fromParts(["user"]),
    defaultWeight: 0,
    description: "a user",
  };
  const userPrefix = userType.prefix;
  const fooType: NodeType = {
    name: "foo",
    pluralName: "foos",
    prefix: NodeAddress.fromParts(["foo"]),
    defaultWeight: 0,
    description: "a foo",
  };
  const fooPrefix = fooType.prefix;
  const plugin: PluginDeclaration = deepFreeze({
    name: "foo",
    nodePrefix: NodeAddress.empty,
    edgePrefix: EdgeAddress.empty,
    nodeTypes: [userType, fooType],
    edgeTypes: [],
    userTypes: [userType],
  });
  const users = [
    ["starter", (x) => Math.max(0, 20 - x)],
    ["steady", (_) => 4],
    ["finisher", (x) => (x * x) / 20],
    ["latecomer", (x) => Math.max(0, x - 20)],
  ];

  // Ensure tests can't contaminate shared state.
  deepFreeze([userType, fooType, users]);

  function exampleTimelineCred(): TimelineCred {
    const startTimeMs = +new Date(2017, 0);
    const endTimeMs = +new Date(2017, 6);
    const boundaries = utcWeek.range(startTimeMs, endTimeMs);
    const intervals = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      intervals.push({
        startTimeMs: +boundaries[i],
        endTimeMs: +boundaries[i + 1],
      });
    }

    const graph = new Graph();
    const addressToCred = new Map();
    for (const [name, generator] of users) {
      const address = NodeAddress.append(userPrefix, name);
      graph.addNode({
        address,
        description: `[@${name}](https://github.com/${name})`,
        timestampMs: null,
      });
      const scores = intervals.map((_unuesd, i) => generator(i));
      addressToCred.set(address, scores);
    }
    for (let i = 0; i < 100; i++) {
      const address = NodeAddress.append(fooPrefix, String(i));
      graph.addNode({
        address,
        timestampMs: null,
        description: `foo ${i}`,
      });
      const scores = intervals.map((_) => i);
      addressToCred.set(address, scores);
    }
    const params = {alpha: 0.05, intervalDecay: 0.5, weights: defaultWeights()};
    return new TimelineCred(graph, intervals, addressToCred, params, [plugin]);
  }

  it("JSON serialization works", () => {
    const tc = exampleTimelineCred();
    const json = exampleTimelineCred().toJSON();
    const tc_ = TimelineCred.fromJSON(json);
    expect(tc.graph()).toEqual(tc_.graph());
  });

  it("cred sorting works", () => {
    const tc = exampleTimelineCred();
    const sorted = tc.credSortedNodes();
    const expected = sortBy(sorted, (x) => -x.total);
    expect(sorted).toEqual(expected);
  });

  it("prefix filtering works", () => {
    const tc = exampleTimelineCred();
    const filtered = tc.credSortedNodes([userPrefix]);
    for (const {node} of filtered) {
      const isUser = NodeAddress.hasPrefix(node.address, userPrefix);
      expect(isUser).toBe(true);
    }
    expect(filtered).toHaveLength(users.length);
  });

  it("prefix filtering can combine disjoint prefixes", () => {
    const tc = exampleTimelineCred();
    const filtered = tc.credSortedNodes([userPrefix, fooPrefix]);
    const all = tc.credSortedNodes();
    expect(filtered).toEqual(all);
  });

  it("prefix filtering will not result in node double-inclusion", () => {
    const tc = exampleTimelineCred();
    const filtered = tc.credSortedNodes([userPrefix, NodeAddress.empty]);
    const all = tc.credSortedNodes();
    expect(filtered).toEqual(all);
  });

  it("an empty list of prefixes results in an empty array", () => {
    const tc = exampleTimelineCred();
    const filtered = tc.credSortedNodes([]);
    expect(filtered).toHaveLength(0);
  });

  it("cred aggregation works", () => {
    const tc = exampleTimelineCred();
    const nodes = tc.credSortedNodes();
    for (const node of nodes) {
      expect(node.total).toEqual(sum(node.cred));
    }
  });

  describe("reduceSize", () => {
    it("chooses top nodes for each type prefix", () => {
      const nodesPerType = 3;
      const tc = exampleTimelineCred();
      const filtered = tc.reduceSize({
        typePrefixes: [userPrefix, fooPrefix],
        nodesPerType,
        fullInclusionPrefixes: [],
      });

      const checkPrefix = (p: NodeAddressT) => {
        const fullNodes = tc.credSortedNodes([p]);
        const truncatedNodes = filtered.credSortedNodes([p]);
        expect(truncatedNodes).toHaveLength(nodesPerType);
        expect(fullNodes.slice(0, nodesPerType)).toEqual(truncatedNodes);
      };
      checkPrefix(userPrefix);
      checkPrefix(fooPrefix);
    });

    it("can keep only scoring nodes", () => {
      const nodesPerType = 3;
      const tc = exampleTimelineCred();
      const filtered = tc.reduceSize({
        typePrefixes: [],
        nodesPerType,
        fullInclusionPrefixes: [userPrefix],
      });
      const fullUserNodes = tc.credSortedNodes([userPrefix]);
      const truncatedUserNodes = filtered.credSortedNodes([userPrefix]);
      expect(fullUserNodes).toEqual(truncatedUserNodes);
      const truncatedFoo = filtered.credSortedNodes([fooPrefix]);
      expect(truncatedFoo).toHaveLength(0);
    });

    it("keeps all scoring nodes (with multiple scoring types)", () => {
      const nodesPerType = 3;
      const tc = exampleTimelineCred();
      const filtered = tc.reduceSize({
        typePrefixes: [userPrefix, NodeAddress.fromParts(["nope"])],
        nodesPerType,
        fullInclusionPrefixes: [userPrefix, fooPrefix],
      });
      const fullUserNodes = tc.credSortedNodes([userPrefix]);
      const truncatedUserNodes = filtered.credSortedNodes([userPrefix]);
      expect(fullUserNodes).toEqual(truncatedUserNodes);
      const fullFoo = tc.credSortedNodes([fooPrefix]);
      const truncatedFoo = filtered.credSortedNodes([fooPrefix]);
      expect(fullFoo).toEqual(truncatedFoo);
    });
  });

  it("userNodes returns the credSortedNodes for user types", () => {
    const tc = exampleTimelineCred();
    expect(tc.userNodes()).toEqual(tc.credSortedNodes([userPrefix]));
  });

  it("credNode returns undefined for absent nodes", () => {
    const tc = exampleTimelineCred();
    expect(tc.credNode(NodeAddress.fromParts(["baz"]))).toBe(undefined);
  });
});
