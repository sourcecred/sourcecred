// @flow

import React from "react";
import {WeightSlider} from "./WeightSlider";
import {type NodeType} from "../../adapters/pluginAdapter";

export type WeightedNodeType = {|+type: NodeType, +weight: number|};

export function defaultWeightedNodeType(type: NodeType): WeightedNodeType {
  return {
    type,
    weight: type.defaultWeight,
  };
}

export class NodeTypeConfig extends React.Component<{
  +weightedType: WeightedNodeType,
  +onChange: (WeightedNodeType) => void,
}> {
  render() {
    return (
      <WeightSlider
        name={this.props.weightedType.type.name}
        weight={this.props.weightedType.weight}
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
