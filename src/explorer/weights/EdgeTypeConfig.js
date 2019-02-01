// @flow

import React from "react";
import {WeightSlider, type Props as WeightSliderProps} from "./WeightSlider";

import type {WeightedEdgeType} from "../../analysis/weights";

export class EdgeTypeConfig extends React.Component<{
  +weightedType: WeightedEdgeType,
  +onChange: (WeightedEdgeType) => void,
}> {
  render() {
    return (
      <div>
        <EdgeWeightSlider
          name={this.props.weightedType.type.backwardName}
          weight={this.props.weightedType.forwardWeight}
          onChange={(forwardWeight) => {
            this.props.onChange({
              ...this.props.weightedType,
              forwardWeight,
            });
          }}
        />
        <EdgeWeightSlider
          name={this.props.weightedType.type.forwardName}
          weight={this.props.weightedType.backwardWeight}
          onChange={(backwardWeight) => {
            this.props.onChange({
              ...this.props.weightedType,
              backwardWeight,
            });
          }}
        />
      </div>
    );
  }
}

export function styledVariable(letter: string) {
  return (
    // marginRight accounts for italicization
    <span style={{fontWeight: 700, fontStyle: "italic", marginRight: "0.15em"}}>
      {letter}
    </span>
  );
}

export class EdgeWeightSlider extends React.Component<WeightSliderProps> {
  render() {
    const modifiedName = (
      <React.Fragment>
        {styledVariable("α")} {this.props.name} {styledVariable("β")}
      </React.Fragment>
    );
    return (
      <WeightSlider
        name={modifiedName}
        weight={this.props.weight}
        onChange={this.props.onChange}
      />
    );
  }
}
