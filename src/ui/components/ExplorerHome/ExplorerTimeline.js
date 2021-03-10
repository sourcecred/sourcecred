// @flow
import React, {type Node as ReactNode} from "react";
import {extent} from "d3-array";
import {scaleLinear} from "d3-scale";
import {line} from "d3-shape";
import {type Grain} from "../../../core/ledger/grain";

const legendTextStyles = {
  fontSize: "10px",
  fill: "#fff",
};
const CRED_COLOR = "#6174CC";
const GRAIN_COLOR = "#FFAA3D";
type ExplorerTimelineProps = {|
  +timelines: {
    cred: Array<number>,
    grain?: Array<Grain>,
  },
  +width?: number,
  +height?: number,
  +hasLegend?: boolean,
  +responsive?: boolean,
|};
const ExplorerTimeline = (props: ExplorerTimelineProps): ReactNode => {
  if (props.timelines.cred == null && props.timelines.grain == null) {
    return <></>;
  }
  const grainExists = props.timelines.grain && true;
  const width = props.width || 300;
  const height = props.height || 25;
  const viewBox = `0 0 ${width} ${height}`;

  let grainValues;
  if (grainExists) {
    const grain = props.timelines.grain || [];
    grainValues = grain.map((g) => {
      return Number(g);
    });
    if (grainValues.length === 1) grainValues.push(grainValues[0]);
  }

  const credValues = props.timelines.cred;
  if (credValues.length === 1) credValues.push(credValues[0]);
  return (
    <svg
      viewBox={props.responsive ? viewBox : null}
      width={props.responsive ? null : width}
      height={props.responsive ? null : height}
      style={{overflow: "visible"}}
    >
      <path
        d={drawLine(credValues, height, width)}
        stroke={CRED_COLOR}
        fill="none"
        strokeWidth={1}
      />
      {grainExists && (
        <path
          d={drawLine(grainValues, height, width)}
          stroke={GRAIN_COLOR}
          fill="none"
          strokeWidth={1}
        />
      )}
      {props.hasLegend ? (
        <g>
          <line
            x1="0"
            y1="110"
            x2={props.width}
            y2="110"
            stroke="#fff"
            strokeOpacity="0.1"
          />
          <circle r="5" cx="5" cy="125" fill={CRED_COLOR} />
          <circle r="5" cx="70" cy="125" fill={GRAIN_COLOR} />
          <text x="15" y="128" style={legendTextStyles}>
            cred
          </text>
          <text x="80" y="128" style={legendTextStyles}>
            grain
          </text>
        </g>
      ) : (
        <></>
      )}
    </svg>
  );
};

function drawLine(data, height, width) {
  if (!data) {
    return null;
  }
  const range = extent(data);
  const xScale = scaleLinear()
    .domain([0, data.length - 1])
    .range([0, width]);
  const yScale = scaleLinear().domain(range).range([height, 0]);
  const generateLine = line()
    .x((_, i) => xScale(i))
    .y((d) => yScale(d));
  return generateLine(data);
}

export default ExplorerTimeline;
