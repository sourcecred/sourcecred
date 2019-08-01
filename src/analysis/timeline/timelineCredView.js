// @flow

import {sum} from "d3-array";
import sortBy from "lodash.sortby";
import stringify from "json-stable-stringify";
import * as NullUtil from "../../util/null";
import {TimelineCred} from "./timelineCred";
import {type Interval, weekIntervals} from "./interval";
import {type Node, type NodeAddressT, NodeAddress} from "../../core/graph";

/**
 * A Graph Node wrapped with cred information.
 */
export type CredNode = {|
  // The Graph Node in question
  +node: Node,
  // The total aggregated cred. (Summed across every interval).
  +total: number,
  // The timeline sequence of cred (one score per interval).
  +cred: $ReadOnlyArray<number>,
|};

/**
 * TimelineCredView allows a retrieving information about nodes' cred
 * for a specific interval of time. The TimelineCredView wraps a TimelineCred
 * instance, and provides methods like `credNode` and `credSortedNodes` for
 * retrieving information on the available nodes and how much cred they earned.
 * Every TimelineCredView is scoped to a certain view interval, which defines
 * the min and max time of cred being viewed. When `CredNode` results are returned,
 * the `total` field will correspond to the view interval of the TimelineCredView.
 * By default, the view interval is chosen to include every underlying interval
 * in the TimelineCred`.
 */
export class TimelineCredView {
  _inputInterval: Interval;
  _viewIntervals: Interval[];
  _timelineCred: TimelineCred;

  // We are displaying a range of the intervals in the base TimelineCred
  // We track the start index and end index of the range, so we can efficiently
  // slice the cred
  _startIntervalIndex: number;
  _endIntervalIndex: number;

  constructor(timelineCred: TimelineCred, inputInterval: ?Interval) {
    this._timelineCred = timelineCred;
    this._inputInterval = NullUtil.orElse(
      inputInterval,
      this._getDefaultInterval(timelineCred)
    );

    this._viewIntervals = weekIntervals(
      this._inputInterval.startTimeMs,
      this._inputInterval.endTimeMs
    );

    this._findIntervalIndices();
  }

  _findIntervalIndices() {
    const baseIntervalStrings = new Set(
      this._timelineCred.intervals().map(stringify)
    );
    const viewIntervalStrings = this._viewIntervals.map(stringify);
    for (const v of viewIntervalStrings) {
      if (!baseIntervalStrings.has(v)) {
        throw new Error(`invariant violation: can't find interval ${v}`);
      }
    }
    this._startIntervalIndex = Array.from(baseIntervalStrings).indexOf(
      viewIntervalStrings[0]
    );
    this._endIntervalIndex = Array.from(baseIntervalStrings).indexOf(
      viewIntervalStrings[viewIntervalStrings.length - 1]
    );

    if (this._startIntervalIndex < 0 || this._endIntervalIndex < 0) {
      throw new Error(`invariant violation: input interval 
        ${stringify(viewIntervalStrings[0]) +
          "-" +
          stringify(viewIntervalStrings[viewIntervalStrings.length - 1])} 
        is not contained in base intervals`);
    }
  }

  intervals(): $ReadOnlyArray<Interval> {
    return this._viewIntervals;
  }

  /**
   * Get the CredNode for a given NodeAddress.
   *
   * Returns undefined if the node is not in the filtered results.
   *
   * Note that it's possible that the node is present in the Graph, but not the
   * filtered results; if so, it will return undefined.
   */
  credNode(a: NodeAddressT): ?CredNode {
    const fullView = this._timelineCred.cred(a);
    if (fullView === undefined || fullView === null) {
      return undefined;
    }

    const cred = fullView.slice(
      this._startIntervalIndex,
      this._endIntervalIndex + 1
    );

    const total = sum(cred);
    const node = NullUtil.get(this._timelineCred.node(a));
    return {cred, total, node};
  }

  /**
   * Return all the nodes matching the prefix, along with their cred,
   * sorted by total cred (descending).
   */
  credSortedNodes(prefix: NodeAddressT): $ReadOnlyArray<CredNode> {
    const match = (a) => NodeAddress.hasPrefix(a, prefix);
    const addresses: NodeAddressT[] = this._timelineCred
      .availableNodes()
      .filter(match);
    const credNodes = addresses.map((a) => this.credNode(a));
    return sortBy(credNodes, (x: CredNode) => -x.total);
  }

  _getDefaultInterval(tc: TimelineCred): Interval {
    // weekIntervals is inclusive of start and end time
    return {
      startTimeMs: tc.intervals()[0].startTimeMs,
      endTimeMs: tc.intervals()[tc.intervals().length - 1].endTimeMs - 1,
    };
  }
}
