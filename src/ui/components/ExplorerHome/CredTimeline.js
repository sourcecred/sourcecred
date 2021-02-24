// @flow
import React, {type Node as ReactNode} from "react";
import {extent} from "d3-array";
import {scaleLinear} from "d3-scale";
import {line} from "d3-shape";
import {type Grain } from "../../../core/ledger/grain";

type ExplorerTimelineProps = {|
  +timelines: {
    cred: $ReadOnlyArray<number>,
    grain?: $ReadOnlyArray<Grain>,
  },
  +width?: number,
  +height?: number,
|};
// TODO change file name
const ExplorerTimeline = (props: ExplorerTimelineProps): ReactNode => {
  if ( props.timelines.cred == null && props.timelines.grain == null) {
    return <></>;
  }
  const grainExists = props.timelines.grain && true;
  const width = props.width || 300;
  const height = props.height || 25;
  const viewBox = `0 0 ${width} ${height}`;
  const intervals = props.timelines.cred.length;
  const xScale = scaleLinear().domain([0, intervals]).range([0, width]);

  let grainRange, grainYScale, grainAsNumber, credRange, grainValues;
  if (grainExists) {
    grainAsNumber = props.timelines.grain.map((g) => { 
      return Number(g);
    });
    grainRange = extent(grainAsNumber); // we might not need this?
    grainYScale = scaleLinear().domain(grainRange).range([height, 0]); // we might not need this either

    const credAndGrain = props.timelines.cred.concat(grainAsNumber);
    credRange = extent(credAndGrain);

    // This is a temporary/quick fix to ensure that the timeline lines fill the entire x-axis
    // and ensures that a line is displayed when there is only one interval.
    grainValues = grainAsNumber.concat(grainAsNumber[intervals - 1]);
  } else {
    credRange = extent(props.timelines.cred);
  }

  const credYScale = scaleLinear().domain(credRange).range([height, 0]);

  // This is a temporary/quick fix to ensure that the timeline lines fill the entire x-axis
  // and ensures that a line is displayed when there is only one interval.
  const credValues = props.timelines.cred.concat(props.timelines.cred[intervals - 1]);

  const generateCredLine = line()
    .x((_, i) => xScale(i))
    .y((d) => credYScale(d));
  const generateGrainLine = line()
    .x((_, i) => xScale(i))
    .y((d) => (props.timelines.grain? credYScale(d) : null));

  function drawGrain(grainExists) {
  if (!grainExists) {
    return <></>;
  }
  return <path d={generateGrainLine(props.timelines.grain)} stroke="#FFAA3D" fill="none" stokewidth={1} />;
  }
  
  return (
    <svg viewBox={viewBox}>
      <path d={generateCredLine(props.timelines.cred)} stroke="cyan" fill="none" stokewidth={1} />
      {drawGrain(grainExists)}
    </svg>
  );
};

// function drawGrain(grain) {
//   const grainExists = grain && true;
//   if (!grainExists) {
//     return <></>;
//   }
//   let grainRange, grainYScale, grainAsNumber;
//   grainAsNumber = grain.map(g => { 
//     Number(g);
//   });
//   grainRange = extent(grainAsNumber);
//   grainYScale = scaleLinear().domain(grainRange).range([height, 0]); 
//   const generateGrainLine = line()
//     .x((_, i) => xScale(i))
//     .y((d) => (props.timelines.grain? grainYScale(d) : null));
//   return <path d={generateGrainLine(grain)} stroke="#FFAA3D" fill="none" stokewidth={1} />;
// }

export default ExplorerTimeline;