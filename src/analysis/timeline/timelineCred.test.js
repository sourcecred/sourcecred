// @flow

import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import {utcWeek} from "d3-time";
import {NodeAddress, Graph} from "../../core/graph";
import {TimelineCred, type TimelineCredConfig} from "./timelineCred";
import {type FilteredTimelineCred} from "./filterTimelineCred";
import {defaultWeights} from "../weights";

describe("src/analysis/timeline/timelineCred", () => {
  const credConfig: () => TimelineCredConfig = () => ({
    scoreNodePrefix: NodeAddress.fromParts(["foo"]),
    filterNodePrefixes: [NodeAddress.fromParts(["foo"])],
    types: {nodeTypes: [], edgeTypes: []},
  });

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
    const users = [
      ["starter", (x) => Math.max(0, 20 - x)],
      ["steady", (_) => 4],
      ["finisher", (x) => (x * x) / 20],
      ["latecomer", (x) => Math.max(0, x - 20)],
    ];

    const graph = new Graph();
    const addressToCred = new Map();
    for (const [name, generator] of users) {
      const address = NodeAddress.fromParts(["foo", name]);
      graph.addNode({
        address,
        description: `[@${name}](https://github.com/${name})`,
        timestampMs: null,
      });
      const scores = intervals.map((_unuesd, i) => generator(i));
      addressToCred.set(address, scores);
    }
    const filteredTimelineCred: FilteredTimelineCred = {
      intervals,
      addressToCred,
    };
    const params = {alpha: 0.05, intervalDecay: 0.5, weights: defaultWeights()};
    return new TimelineCred(graph, filteredTimelineCred, params, credConfig());
  }

  it("JSON serialization works", () => {
    const tc = exampleTimelineCred();
    const json = exampleTimelineCred().toJSON();
    const tc_ = TimelineCred.fromJSON(json);
    expect(tc.graph()).toEqual(tc_.graph());
    expect(tc.params()).toEqual(tc_.params());
    expect(tc.config()).toEqual(tc_.config());
    expect(tc.credSortedNodes(NodeAddress.empty)).toEqual(
      tc.credSortedNodes(NodeAddress.empty)
    );
  });

  it("cred sorting works", () => {
    const tc = exampleTimelineCred();
    const sorted = tc.credSortedNodes(NodeAddress.empty);
    const expected = sortBy(sorted, (x) => -x.total);
    expect(sorted).toEqual(expected);
  });

  it("cred aggregation works", () => {
    const tc = exampleTimelineCred();
    const nodes = tc.credSortedNodes(NodeAddress.empty);
    for (const node of nodes) {
      expect(node.total).toEqual(sum(node.cred));
    }
  });

  it("credNode returns undefined for absent nodes", () => {
    const tc = exampleTimelineCred();
    expect(tc.credNode(NodeAddress.fromParts(["baz"]))).toBe(undefined);
  });
});
