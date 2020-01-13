// @flow

import React from "react";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../../util/null";

import {type NodeAddressT} from "../../../core/graph";
import {TableRow} from "./TableRow";
import {
  MIN_SLIDER,
  MAX_SLIDER,
  formatWeight,
  sliderToWeight,
  weightToSlider,
} from "../../weights/WeightSlider";

import {nodeDescription, type SharedProps} from "./shared";

import {AggregationRowList} from "./Aggregation";

type NodeRowListProps = {|
  +nodes: $ReadOnlyArray<NodeAddressT>,
  +sharedProps: SharedProps,
|};

export class NodeRowList extends React.PureComponent<NodeRowListProps> {
  render() {
    const {nodes, sharedProps} = this.props;
    const {pnd, maxEntriesPerList} = sharedProps;
    return (
      <React.Fragment>
        {sortBy(
          nodes,
          (n) => -NullUtil.get(pnd.get(n)).score,
          (n) => n
        )
          .slice(0, maxEntriesPerList)
          .map((node) => (
            <NodeRow
              showPadding={false}
              depth={0}
              node={node}
              key={node}
              sharedProps={sharedProps}
            />
          ))}
      </React.Fragment>
    );
  }
}

export type NodeRowProps = {|
  +depth: number,
  +node: NodeAddressT,
  +sharedProps: SharedProps,
  +showPadding: boolean,
|};

export class NodeRow extends React.PureComponent<NodeRowProps> {
  render() {
    const {depth, node, sharedProps, showPadding} = this.props;
    const {pnd, graph, onNodeWeightsChange, nodeWeights} = sharedProps;
    const {score} = NullUtil.get(pnd.get(node));
    const weight = NullUtil.orElse(nodeWeights.get(node), 1);
    const slider = (
      <label>
        <span>{formatWeight(weight)}</span>
        <input
          type="range"
          min={MIN_SLIDER}
          max={MAX_SLIDER}
          step={1}
          value={weightToSlider(weight)}
          onChange={(e) => {
            const weight = sliderToWeight(e.target.valueAsNumber);
            onNodeWeightsChange(node, weight);
          }}
        />
      </label>
    );
    const description = <span>{nodeDescription(node, graph)}</span>;
    return (
      <TableRow
        depth={depth}
        indent={0}
        showPadding={showPadding}
        description={description}
        multiuseColumn={slider}
        cred={score}
      >
        <AggregationRowList
          depth={depth}
          node={node}
          sharedProps={sharedProps}
        />
      </TableRow>
    );
  }
}
