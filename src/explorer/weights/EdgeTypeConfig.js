// @flow

import React from "react";
import {WeightSlider, type Props as WeightSliderProps} from "./WeightSlider";

import type {WeightedEdgeType} from "../../analysis/weights";

export class EdgeTypeConfig extends React.Component<{
  +weightedType: WeightedEdgeType,
  +onChange: (WeightedEdgeType) => void,
}> {
  render() {
    const {weight, type} = this.props.weightedType;
    const {forwards, backwards} = weight;
    const {forwardName, backwardName, description} = type;
    return (
      <div>
        <EdgeWeightSlider
          name={backwardName}
          weight={forwards}
          description={description}
          onChange={(newForwards) => {
            this.props.onChange({
              type,
              weight: {forwards: newForwards, backwards},
            });
          }}
        />
        <EdgeWeightSlider
          name={forwardName}
          weight={backwards}
          description={description}
          onChange={(newBackwards) => {
            this.props.onChange({
              type,
              weight: {forwards, backwards: newBackwards},
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
        description={this.props.description}
        onChange={this.props.onChange}
      />
    );
  }
}
