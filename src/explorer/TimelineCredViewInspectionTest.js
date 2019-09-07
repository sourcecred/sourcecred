// @flow

import React from "react";
import {timeWeek} from "d3-time";
import type {Assets} from "../webutil/assets";
import {TimelineCredView} from "./TimelineCredView";
import {Graph, NodeAddress} from "../core/graph";
import {
  type Interval,
  TimelineCred,
  type TimelineCredConfig,
} from "../analysis/timeline/timelineCred";
import {defaultWeights} from "../analysis/weights";

export default class TimelineCredViewInspectiontest extends React.Component<{|
  +assets: Assets,
|}> {
  intervals(): Interval[] {
    const startTimeMs = +new Date(2017, 0);
    const endTimeMs = +new Date(2017, 6);
    const boundaries = timeWeek.range(startTimeMs, endTimeMs);
    const result = [];
    for (let i = 0; i < boundaries.length - 1; i++) {
      result.push({
        startTimeMs: +boundaries[i],
        endTimeMs: +boundaries[i + 1],
      });
    }
    return result;
  }

  timelineCred(): TimelineCred {
    const intervals = this.intervals();
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
    const params = {alpha: 0.05, intervalDecay: 0.5, weights: defaultWeights()};
    const config: TimelineCredConfig = {
      scoreNodePrefixes: [NodeAddress.empty],
      types: {nodeTypes: [], edgeTypes: []},
    };
    return new TimelineCred(graph, intervals, addressToCred, params, config);
  }

  render() {
    const selectedNodeFilter = NodeAddress.fromParts(["foo"]);
    return (
      <TimelineCredView
        timelineCred={this.timelineCred()}
        selectedNodeFilter={selectedNodeFilter}
      />
    );
  }
}
