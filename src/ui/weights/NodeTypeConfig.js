// @flow

import type {Node} from "React";
import React from "react";
import {WeightSlider} from "./WeightSlider";
import type {NodeType} from "../../analysis/types";
import type {NodeWeight} from "../../core/weights";

export class NodeTypeConfig extends React.Component<{
  +weight: NodeWeight,
  +type: NodeType,
  +onChange: (NodeWeight) => void,
}> {
  render(): Node {
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
