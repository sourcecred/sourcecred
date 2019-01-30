// @flow

import React from "react";
import {WeightSlider} from "./WeightSlider";
import type {WeightedNodeType} from "../../analysis/weights";

export class NodeTypeConfig extends React.Component<{
  +weightedType: WeightedNodeType,
  +onChange: (WeightedNodeType) => void,
}> {
  render() {
    return (
      <WeightSlider
        name={this.props.weightedType.type.name}
        weight={this.props.weightedType.weight}
        description={this.props.weightedType.type.description}
        onChange={(weight) => {
          this.props.onChange({
            ...this.props.weightedType,
            weight,
          });
        }}
      />
    );
  }
}
