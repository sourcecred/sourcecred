// @flow

import React from "react";
import deepEqual from "lodash.isequal";
import * as MapUtil from "../../../util/map";
import {NodeTypeConfig} from "./NodeTypeConfig";
import {EdgeTypeConfig} from "./EdgeTypeConfig";
import {StaticAppAdapter} from "../../adapters/appAdapter";
import {styledVariable} from "./EdgeTypeConfig";
import type {
  WeightedTypes,
  WeightedEdgeType,
  WeightedNodeType,
} from "../../../analysis/weights";

export type Props = {|
  +adapter: StaticAppAdapter,
  +onChange: (WeightedTypes) => void,
  +weightedTypes: WeightedTypes,
|};

export class PluginWeightConfig extends React.Component<Props> {
  constructor(props: Props) {
    super(props);
  }

  _renderNodeWeightControls() {
    return Array.from(this.props.weightedTypes.nodes.values()).map(
      (wnt: WeightedNodeType) => {
        const onChange = (newType: WeightedNodeType) => {
          const newNodes = MapUtil.copy(this.props.weightedTypes.nodes);
          newNodes.set(newType.type.prefix, newType);
          const weights = {...this.props.weightedTypes, nodes: newNodes};
          this.props.onChange(weights);
        };
        return (
          <NodeTypeConfig
            key={wnt.type.prefix}
            weightedType={wnt}
            onChange={onChange}
          />
        );
      }
    );
  }

  _renderEdgeWeightControls() {
    return Array.from(this.props.weightedTypes.edges.values()).map(
      (wnt: WeightedEdgeType) => {
        const onChange = (newType: WeightedEdgeType) => {
          const newEdges = MapUtil.copy(this.props.weightedTypes.edges);
          newEdges.set(newType.type.prefix, newType);
          const weights = {...this.props.weightedTypes, edges: newEdges};
          this.props.onChange(weights);
        };
        return (
          <EdgeTypeConfig
            key={wnt.type.prefix}
            weightedType={wnt}
            onChange={onChange}
          />
        );
      }
    );
  }

  _validateWeightedTypesWithAdapter() {
    const expectedNodePrefixes = new Set(
      this.props.adapter.declaration().nodeTypes.map((x) => x.prefix)
    );
    const actualNodePrefixes = new Set(this.props.weightedTypes.nodes.keys());
    if (!deepEqual(expectedNodePrefixes, actualNodePrefixes)) {
      throw new Error("weightedTypes has wrong node prefixes for adapter");
    }
    const expectedEdgePrefixes = new Set(
      this.props.adapter.declaration().edgeTypes.map((x) => x.prefix)
    );
    const actualEdgePrefixes = new Set(this.props.weightedTypes.edges.keys());
    if (!deepEqual(expectedEdgePrefixes, actualEdgePrefixes)) {
      throw new Error("weightedTypes has wrong edge prefixes for adapter");
    }
  }

  render() {
    this._validateWeightedTypesWithAdapter();
    return (
      <div>
        <h3>{this.props.adapter.declaration().name}</h3>
        <h4 style={{marginBottom: "0.3em"}}>Node weights</h4>
        {this._renderNodeWeightControls()}
        <h4 style={{marginBottom: "0.3em"}}>Edge weights</h4>
        <p style={{marginBottom: "0.6em", marginTop: "0.6em"}}>
          Flow cred from {styledVariable("β")} to {styledVariable("α")} when:
        </p>
        {this._renderEdgeWeightControls()}
      </div>
    );
  }
}
