// @flow

import React, {type Node as ReactNode} from "react";
import {WeightSlider, type Props as WeightSliderProps} from "./WeightSlider";

import type {EdgeType} from "../../analysis/types";
import type {EdgeWeight} from "../../core/weights";

export class EdgeTypeConfig extends React.Component<{
  +weight: EdgeWeight,
  +type: EdgeType,
  +onChange: (EdgeWeight) => void,
}> {
  render(): ReactNode {
    const {weight, type} = this.props;
    const {forwards, backwards} = weight;
    const {forwardName, backwardName, description} = type;
    return (
      <div>
        <EdgeWeightSlider
          name={backwardName}
          weight={forwards}
          description={description}
          onChange={(newForwards) => {
            this.props.onChange({forwards: newForwards, backwards});
          }}
        />
        <EdgeWeightSlider
          name={forwardName}
          weight={backwards}
          description={description}
          onChange={(newBackwards) => {
            this.props.onChange({
              forwards,
              backwards: newBackwards,
            });
          }}
        />
      </div>
    );
  }
}

export function styledVariable(letter: string): ReactNode {
  return (
    // marginRight accounts for italicization
    <span style={{fontWeight: 700, fontStyle: "italic", marginRight: "0.15em"}}>
      {letter}
    </span>
  );
}

export class EdgeWeightSlider extends React.Component<WeightSliderProps> {
  render(): ReactNode {
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
