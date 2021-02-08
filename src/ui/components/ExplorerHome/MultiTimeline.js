// @flow
import React from "react";
import {extent} from "d3-array";
import {scaleLinear} from "d3-scale";
import {line} from "d3-shape";

type CredTimelineProps = {|
  +data: $ReadOnlyArray<number> | null,
  +width?: number,
  +height?: number,
|};

type MultiTimelineProps = {|
  +cred: $ReadOnlyArray<number> | null,
  +grain: $ReadOnlyArray<number> | null,
  +width?: number,
  +height?: number,
|};

const makeGenerator = (props: CredTimelineProps) => {
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

  return gen;
}

const CredTimeline = (props: MultiTimelineProps) => {
  const {cred, grain, width, height} = props;

  const credGen: any = makeGenerator({ data: cred, width, height });
  const grainGen: any = makeGenerator({ data: grain, width, height });

  return (
    <svg width={width} height={height}>
      <path d={credGen(cred)} stroke="#6174CC" fill="none" strokeWidth={3} />
      <path d={grainGen(grain)} stroke="#FFAA3D" fill="none" strokeWidth={3} />
    </svg>
  );
};

export default CredTimeline;
