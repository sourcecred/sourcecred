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
  +hasLegend?: boolean,
  +responsive?: boolean,
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
  const credLineColor = "#6174CC";
  const grainLineColor = "#FFAA3D";

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
    return <path d={generateGrainLine(grainValues)} stroke={grainLineColor} fill="none" stokewidth={1} />;
  }

  const legendTextStyles = {
    fontSize: '10px',
    fill: '#fff',
  };
  
  return (
    <svg viewBox={props.responsive ? viewBox : null}  
      width={props.responsive ? null : width} 
      height={props.responsive ? null : height} 
      style={{overflow: 'visible'}} >
      <path d={generateCredLine(credValues)} stroke={credLineColor} fill="none" stokewidth={1} />
      { drawGrain(grainExists) }
      { props.hasLegend 
        ? <g> 
          <line x1="0" y1="110" x2={props.width} y2="110" stroke="#fff" stroke-opacity="0.1"/>
          <circle r="5"  cx="5" cy="125" fill={credLineColor}/>
          <circle r="5"  cx="70" cy="125" fill={grainLineColor}/>
          <text x="15" y="128" style={legendTextStyles}>cred</text>
          <text x="80" y="128" style={legendTextStyles}>grain</text>
        </g>

        
        : <></> }
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