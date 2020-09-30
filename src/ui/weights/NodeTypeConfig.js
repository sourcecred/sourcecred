// @flow

import React, {type Node as ReactNode} from "react";
import {WeightSlider} from "./WeightSlider";
import type {NodeType} from "../../analysis/types";
import type {NodeWeight} from "../../core/weights";

export class NodeTypeConfig extends React.Component<{
  +weight: NodeWeight,
  +type: NodeType,
  +onChange: (NodeWeight) => void,
}> {
  render(): ReactNode {
    return (
      <WeightSlider
        name={this.props.type.name}
        weight={this.props.weight}
        description={this.props.type.description}
        onChange={(weight) => this.props.onChange(weight)}
      />
    );
  }
}
