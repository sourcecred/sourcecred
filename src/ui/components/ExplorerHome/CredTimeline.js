// @flow
import React, {type Node as ReactNode} from "react";
import {extent} from "d3-array";
import {scaleLinear} from "d3-scale";
import {line} from "d3-shape";

type CredTimelineProps = {|
  +data: $ReadOnlyArray<number> | null,
  +width?: number,
  +height?: number,
|};

const CredTimeline = (props: CredTimelineProps): ReactNode => {
  const {data} = props;
  if (data == null) {
    return "";
  }

  const width = props.width || 300;
  const height = props.height || 25;

  const ext = extent(data);
  const xScale = scaleLinear().domain([0, data.length]).range([0, width]);
  const yScale = scaleLinear().domain(ext).range([height, 0]);
  const gen = line()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d));

  return (
    <svg width={width} height={height}>
      <path d={gen(data)} stroke="cyan" fill="none" stokewidth={1} />
    </svg>
  );
};

export default CredTimeline;
