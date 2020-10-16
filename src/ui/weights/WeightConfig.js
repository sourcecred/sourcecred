// @flow

import React, {type Node as ReactNode} from "react";
import * as NullUtil from "../../util/null";
import {Grid} from "@material-ui/core";
import {type NodeAddressT, type EdgeAddressT} from "../../core/graph";
import {type EdgeWeight, type NodeWeight} from "../../core/weights";
import {type NodeType, type EdgeType} from "../../analysis/types";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {NodeTypeConfig} from "./NodeTypeConfig";
import {EdgeTypeConfig, styledVariable} from "./EdgeTypeConfig";

type Props = {|
  +declarations: $ReadOnlyArray<PluginDeclaration>,
  // Map from NodeType prefix to weight.
  +nodeWeights: Map<NodeAddressT, NodeWeight>,
  // Map from EdgeType prefix to weight.
  +edgeWeights: Map<EdgeAddressT, EdgeWeight>,
  +onNodeWeightChange: (NodeAddressT, number) => void,
  +onEdgeWeightChange: (EdgeAddressT, EdgeWeight) => void,
|};

/**
 * A React component that lets users set Type-level weights.
 *
 * The WeightConfig component renders a slider for every ReactNode and Edge type
 * within the array of declarations it's been provided. The sliders are
 * organized by plugin at the top level, and then by whether they represent
 * node or edge types at the level beneath.
 *
 * Each slider displays the weight associated in the `nodeWeights` or
 * `edgeWeights` maps provided in props. When the user changes the weight,
 * `onNodeWeightChange` or `onEdgeWeightChange` is called with the new weight.
 */
export class WeightConfig extends React.Component<Props> {
  _nodeConfig(type: NodeType): ReactNode {
    const {prefix, defaultWeight} = type;
    const {onNodeWeightChange, nodeWeights} = this.props;
    const weight = NullUtil.orElse(nodeWeights.get(prefix), defaultWeight);
    const onChange = (weight) => onNodeWeightChange(prefix, weight);
    return (
      <NodeTypeConfig
        key={prefix}
        type={type}
        weight={weight}
        onChange={onChange}
      />
    );
  }

  _edgeConfig(type: EdgeType): ReactNode {
    const {prefix, defaultWeight} = type;
    const {onEdgeWeightChange, edgeWeights} = this.props;
    const weight = NullUtil.orElse(edgeWeights.get(prefix), defaultWeight);
    const onChange = (weight) => onEdgeWeightChange(prefix, weight);
    return (
      <EdgeTypeConfig
        key={prefix}
        type={type}
        weight={weight}
        onChange={onChange}
      />
    );
  }

  _renderPlugin(declaration: PluginDeclaration): ReactNode {
    const {name, nodeTypes, edgeTypes, userTypes} = declaration;
    const nonUserTypes = nodeTypes.filter(
      ({prefix}) => !userTypes.some((t) => t.prefix === prefix)
    );
    const nodeConfigs = nonUserTypes.map((t) => this._nodeConfig(t));
    const edgeConfigs = edgeTypes.map((t) => this._edgeConfig(t));
    return (
      <Grid item xs={4} key={name}>
        <h3>{name}</h3>
        <h4 style={{marginBottom: "0.3em"}}>Node weights</h4>
        {nodeConfigs}
        <h4 style={{marginBottom: "0.3em"}}>Edge weights</h4>
        <p style={{marginBottom: "0.6em", marginTop: "0.6em"}}>
          Flow cred from {styledVariable("β")} to {styledVariable("α")} when:
        </p>
        {edgeConfigs}
      </Grid>
    );
  }

  render(): ReactNode {
    return (
      <Grid container spacing={2}>
        {this.props.declarations.map((x) => this._renderPlugin(x))}
      </Grid>
    );
  }
}
