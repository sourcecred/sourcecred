// @flow

import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import {utcWeek} from "d3-time";
import {NodeAddress, Graph} from "../../core/graph";
import {TimelineCred, type TimelineCredConfig} from "./timelineCred";
import {TimelineCredView} from "./timelineCredView";
import {type FilteredTimelineCred} from "./filterTimelineCred";
import {defaultWeights} from "../weights";

describe("src/analysis/timeline/timelineCredView", () => {
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
      const scores = intervals.map((_unused_, i) => generator(i));
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
    const json = exampleTimelineCred().toJSON();
    const tc_ = TimelineCred.fromJSON(json, credConfig());
    const tcv = new TimelineCredView(exampleTimelineCred());
    const tcv_ = new TimelineCredView(tc_);
    expect(tcv.credSortedNodes(NodeAddress.empty)).toEqual(
      tcv_.credSortedNodes(NodeAddress.empty)
    );
  });

  it("default interval works", () => {
    const tc = exampleTimelineCred();
    const tcv = new TimelineCredView(tc);
    expect(tc.intervals()).toEqual(tcv.intervals());
  });

  it("single input interval works", () => {
    const tc = exampleTimelineCred();
    const startTimeMs = +new Date(2017, 1);
    const inputInterval = {startTimeMs: startTimeMs, endTimeMs: startTimeMs};
    const tcv = new TimelineCredView(tc, inputInterval);
    expect(tcv.intervals().length).toEqual(1);
  });

  it("straddle input interval works", () => {
    const tc = exampleTimelineCred();
    const startTimeMs = +new Date(2017, 0, 14);
    const endTimeMs = +new Date(2017, 0, 14 + 7 + 2);
    const inputInterval = {startTimeMs: startTimeMs, endTimeMs: endTimeMs};
    const tcv = new TimelineCredView(tc, inputInterval);
    expect(tcv.intervals().length).toEqual(3);
  });

  it("cred sorting works", () => {
    const tcv = new TimelineCredView(exampleTimelineCred());
    const sorted = tcv.credSortedNodes(NodeAddress.empty);
    const expected = sortBy(sorted, (x) => -x.total);
    expect(sorted).toEqual(expected);
  });

  it("cred interval consistency checks", () => {
    const boundaries = utcWeek.range(+new Date(2017, 0), +new Date(2017, 6));
    const startTimeIndex = Math.floor(Math.random() * boundaries.length - 1);
    const endTimeIndex =
      Math.floor(Math.random() * (boundaries.length - startTimeIndex - 1)) +
      startTimeIndex;
    const intervalStartTimeMs = +boundaries[startTimeIndex];
    const intervalEndTimeMs = +boundaries[endTimeIndex];
    const inputInterval = {
      startTimeMs: intervalStartTimeMs,
      endTimeMs: intervalEndTimeMs,
    };
    const tcv = new TimelineCredView(exampleTimelineCred(), inputInterval);
    tcv.credSortedNodes(NodeAddress.empty).forEach((node) => {
      expect(node.cred.length).toEqual(endTimeIndex - startTimeIndex + 1);
      expect(node.cred.length).toEqual(tcv.intervals().length);
      for (const {startTimeMs, endTimeMs} of tcv.intervals()) {
        expect(startTimeMs).toBeGreaterThanOrEqual(intervalStartTimeMs);
        expect(endTimeMs).toBeLessThanOrEqual(+boundaries[endTimeIndex + 1]);
      }
    });
  });

  it("filterTimelineCred only contains subgraph works", () => {
    const tcv = new TimelineCredView(exampleTimelineCred());
    const addressToDelete = NodeAddress.fromParts(["foo", "steady"]);
    tcv._timelineCred._cred.addressToCred.delete(addressToDelete);
    const sortedEmpty = tcv.credSortedNodes(addressToDelete);
    const sorted = tcv.credSortedNodes(NodeAddress.empty);
    expect(sorted.length).toEqual(3);
    expect(sortedEmpty.length).toEqual(0);
  });

  it("cred aggregation works", () => {
    const tcv = new TimelineCredView(exampleTimelineCred());
    const nodes = tcv.credSortedNodes(NodeAddress.empty);
    for (const node of nodes) {
      expect(node.total).toEqual(sum(node.cred));
    }
  });

  it("credNode returns undefined for absent nodes", () => {
    const tcv = new TimelineCredView(exampleTimelineCred());
    expect(tcv.credNode(NodeAddress.fromParts(["baz"]))).toBe(undefined);
  });
});
