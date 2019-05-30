// @flow

import {computeCreationTimeline} from "./creationTimeline";
import {NodeAddress} from "../../core/graph";

describe("src/analysis/temporal/creationTimeline", () => {
  const foo = NodeAddress.fromParts(["foo"]);
  const bar = NodeAddress.fromParts(["bar"]);

  it("gives empty timeline with empty input", () => {
    const {creationIntervals, timelessNodes} = computeCreationTimeline(
      new Map(),
      10
    );
    expect(creationIntervals).toHaveLength(0);
    expect(timelessNodes).toHaveLength(0);
  });
  it("gives empty intervals if all nodes are timeless", () => {
    const map = new Map([[foo, null], [bar, null]]);
    const {creationIntervals, timelessNodes} = computeCreationTimeline(map, 10);
    expect(creationIntervals).toHaveLength(0);
    expect(timelessNodes).toEqual([foo, bar]);
  });
  it("throws an error if the intervalLength is 0", () => {
    const bads = [-10, 0, 0.5];
    for (const bad of bads) {
      expect(() => computeCreationTimeline(new Map(), bad)).toThrowError(
        "interval length"
      );
    }
  });
  it("creates intervals starting at first non-null timestamp", () => {
    const map = new Map([[foo, 7], [bar, null]]);
    const {creationIntervals, timelessNodes} = computeCreationTimeline(map, 10);
    expect(creationIntervals).toHaveLength(1);
    const {interval, nodes} = creationIntervals[0];
    expect(interval).toEqual({startTime: 7, endTime: 17});
    expect(nodes).toEqual([foo]);
    expect(timelessNodes).toEqual([bar]);
  });
  it("buckets multiple nodes into the same interval", () => {
    const map = new Map([[foo, 7], [bar, 9]]);
    const {creationIntervals, timelessNodes} = computeCreationTimeline(map, 10);
    expect(creationIntervals).toHaveLength(1);
    const {interval, nodes} = creationIntervals[0];
    expect(interval).toEqual({startTime: 7, endTime: 17});
    expect(nodes).toEqual([foo, bar]);
    expect(timelessNodes).toEqual([]);
  });
  it("puts nodes exactly on a boundary into the next interval", () => {
    const map = new Map([[foo, 7], [bar, 17]]);
    const {creationIntervals, timelessNodes} = computeCreationTimeline(map, 10);
    expect(creationIntervals).toHaveLength(2);
    expect(creationIntervals[0].interval).toEqual({startTime: 7, endTime: 17});
    expect(creationIntervals[0].nodes).toEqual([foo]);
    expect(creationIntervals[1].interval).toEqual({startTime: 17, endTime: 27});
    expect(creationIntervals[1].nodes).toEqual([bar]);
    expect(timelessNodes).toEqual([]);
  });
  it("skips over empty intervals", () => {
    const map = new Map([[foo, 7], [bar, 17]]);
    const {creationIntervals, timelessNodes} = computeCreationTimeline(map, 2);
    expect(creationIntervals[0].interval).toEqual({startTime: 7, endTime: 9});
    expect(creationIntervals[0].nodes).toEqual([foo]);
    expect(creationIntervals[1].interval).toEqual({startTime: 17, endTime: 19});
    expect(creationIntervals[1].nodes).toEqual([bar]);
    expect(timelessNodes).toEqual([]);
  });
});
