// @flow

import deepFreeze from "deep-freeze";
import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import {utcWeek} from "d3-time";
import {NodeAddress, EdgeAddress} from "../../core/graph";
import * as WeightedGraph from "../../core/weightedGraph";
import {TimelineCred} from "./timelineCred";
import {defaultParams} from "./params";
import {type PluginDeclaration} from "../pluginDeclaration";
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

    const weightedGraph = WeightedGraph.empty();
    const addressToCred = new Map();
    for (const [name, generator] of users) {
      const address = NodeAddress.append(userPrefix, name);
      weightedGraph.graph.addNode({
        address,
        description: `[@${name}](https://github.com/${name})`,
        timestampMs: null,
      });
      const scores = intervals.map((_unuesd, i) => generator(i));
      addressToCred.set(address, scores);
    }
    for (let i = 0; i < 100; i++) {
      const address = NodeAddress.append(fooPrefix, String(i));
      weightedGraph.graph.addNode({
        address,
        timestampMs: null,
        description: `foo ${i}`,
      });
      const scores = intervals.map((_) => i);
      addressToCred.set(address, scores);
    }
    return new TimelineCred(
      weightedGraph,
      intervals,
      addressToCred,
      defaultParams(),
      [plugin]
    );
  }

  it("JSON serialization works", () => {
    const tc = exampleTimelineCred();
    const json = exampleTimelineCred().toJSON();
    const tc_ = TimelineCred.fromJSON(json);
    expect(tc.weightedGraph()).toEqual(tc_.weightedGraph());
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

  it("userNodes returns the credSortedNodes for user types", () => {
    const tc = exampleTimelineCred();
    expect(tc.userNodes()).toEqual(tc.credSortedNodes([userPrefix]));
  });

  it("credNode returns undefined for absent nodes", () => {
    const tc = exampleTimelineCred();
    expect(tc.credNode(NodeAddress.fromParts(["baz"]))).toBe(undefined);
  });
});
