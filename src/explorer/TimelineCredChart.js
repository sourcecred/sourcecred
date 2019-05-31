// @flow

import React from "react";
import removeMd from "remove-markdown";
import {schemeCategory10} from "d3-scale-chromatic";
import {timeFormat} from "d3-time-format";
import {scaleOrdinal} from "d3-scale";
import {timeMonth, timeYear} from "d3-time";
import {format} from "d3-format";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import * as NullUtil from "../util/null";
import {type NodeAddressT} from "../core/graph";
import {type Interval, TimelineCred} from "../analysis/timeline/timelineCred";

export type Props = {
  timelineCred: TimelineCred,
  displayedNodes: $ReadOnlyArray<NodeAddressT>,
};

type LineChartDatum = {
  interval: Interval,
  // May be null if the node score was filtered out (effectively bc.
  // that node did not exist yet)
  score: Map<NodeAddressT, ?number>,
};

// TODO: Make the line chart auto-scale based on its container
export const LINE_CHART_WIDTH = 1000;
export const LINE_CHART_HEIGHT = 500;

/**
 * Renders a line chart showing cred over time for the node addresses in
 * props.displayedNodes.
 *
 * To see a demo, you can check out the TimelineCredView inspection test.
 * Run `yarn start` and navigate to:
 * http://localhost:8080/test/TimelineCredView/
 */
export class TimelineCredChart extends React.Component<Props> {
  render() {
    const {timelineCred, displayedNodes} = this.props;
    const intervals = timelineCred.intervals();
    const timeDomain = [
      intervals[0].startTimeMs,
      intervals[intervals.length - 1].endTimeMs,
    ];
    const data: LineChartDatum[] = intervals.map((interval, index) => {
      const score = new Map();
      for (const node of displayedNodes) {
        const {cred} = NullUtil.get(timelineCred.credNode(node));
        const lastScore = index === 0 ? 0 : cred[index - 1];
        const nextScore = index === intervals.length - 1 ? 0 : cred[index + 1];
        const thisScore = cred[index];
        // Filter a score out if it's on the zero line and not going anywhere.
        // This makes the tooltips a lot cleaner.
        // (Ideally we would have more control over the tooltips display directly
        // without munging the data...)
        const filteredScore =
          Math.max(lastScore, nextScore, thisScore) < 0.1 ? null : thisScore;
        score.set(node, filteredScore);
      }
      return {score, interval};
    });
    const scale = scaleOrdinal(displayedNodes, schemeCategory10);
    const Lines = displayedNodes.map((n: NodeAddressT) => {
      const description = NullUtil.get(timelineCred.graph().node(n))
        .description;
      const plainDescription = removeMd(description);
      return (
        <Line
          type="monotone"
          dot={false}
          key={n}
          stroke={scale(n)}
          dataKey={(x) => x.score.get(n)}
          name={plainDescription}
        />
      );
    });

    const formatMonth = timeFormat("%b");
    const formatYear = timeFormat("%Y");

    function multiFormat(dateMs) {
      const date = new Date(dateMs);
      return timeYear(date) < date ? formatMonth(date) : formatYear(date);
    }

    const ticks = timeMonth.range(...timeDomain);

    return (
      <LineChart
        width={LINE_CHART_WIDTH}
        height={LINE_CHART_HEIGHT}
        data={data}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis
          dataKey={(x) => x.interval.startTimeMs}
          type="number"
          domain={timeDomain}
          tickFormatter={multiFormat}
          ticks={ticks}
        />
        <YAxis />
        {Lines}
        <Tooltip
          formatter={format(".1d")}
          itemSorter={(x) => -x.value}
          labelFormatter={(v) => {
            return `Week of ${timeFormat("%B %e, %Y")(v)}`;
          }}
        />
        <Legend />
      </LineChart>
    );
  }
}
