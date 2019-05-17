// @flow

import React from "react";
import * as NullUtil from "../../util/null";

import type {NodeAddressT} from "../../core/graph";
import {ConnectionRowList} from "./Connection";

import {aggregateFlat, type FlatAggregation, aggregationKey} from "./aggregate";

import {Badge, type SharedProps} from "./shared";
import {TableRow} from "./TableRow";

type AggregationRowListProps = {|
  +depth: number,
  +node: NodeAddressT,
  +sharedProps: SharedProps,
|};

export class AggregationRowList extends React.PureComponent<
  AggregationRowListProps
> {
  render() {
    const {depth, node, sharedProps} = this.props;
    const {pnd, adapters} = sharedProps;
    const {scoredConnections} = NullUtil.get(pnd.get(node));
    const aggregations = aggregateFlat(
      scoredConnections,
      adapters.static().nodeTypes(),
      adapters.static().edgeTypes()
    );
    return (
      <React.Fragment>
        {aggregations.map((agg) => (
          <AggregationRow
            key={aggregationKey(agg)}
            depth={depth}
            target={node}
            sharedProps={sharedProps}
            aggregation={agg}
          />
        ))}
      </React.Fragment>
    );
  }
}

type AggregationRowProps = {|
  +depth: number,
  +target: NodeAddressT,
  +aggregation: FlatAggregation,
  +sharedProps: SharedProps,
|};

export class AggregationRow extends React.PureComponent<AggregationRowProps> {
  render() {
    const {sharedProps, target, depth, aggregation} = this.props;
    const {pnd} = sharedProps;
    const score = aggregation.summary.score;
    const {score: targetScore} = NullUtil.get(pnd.get(target));
    const connectionProportion = score / targetScore;
    const connectionPercent = (connectionProportion * 100).toFixed(2) + "%";

    return (
      <TableRow
        depth={depth}
        indent={1}
        showPadding={false}
        multiuseColumn={connectionPercent}
        cred={score}
        description={<AggregationView aggregation={aggregation} />}
      >
        <ConnectionRowList
          key="children"
          depth={depth}
          node={target}
          connections={aggregation.connections}
          sharedProps={sharedProps}
        />
      </TableRow>
    );
  }
}

export class AggregationView extends React.PureComponent<{|
  +aggregation: FlatAggregation,
|}> {
  render() {
    const {aggregation} = this.props;
    const {connectionType, summary, nodeType} = aggregation;
    function connectionDescription() {
      switch (connectionType.type) {
        case "SYNTHETIC_LOOP":
          return "synthetic loop";
        case "IN_EDGE":
          return connectionType.edgeType.backwardName;
        case "OUT_EDGE":
          return connectionType.edgeType.forwardName;
        default:
          throw new Error((connectionType.type: empty));
      }
    }
    const nodeName = summary.size === 1 ? nodeType.name : nodeType.pluralName;
    return (
      <span>
        <Badge>{connectionDescription()}</Badge>
        <span> {summary.size} </span>
        <span style={{textTransform: "lowercase"}}>{nodeName}</span>
      </span>
    );
  }
}
