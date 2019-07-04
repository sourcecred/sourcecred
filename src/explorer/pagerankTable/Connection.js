// @flow

import React from "react";
import * as NullUtil from "../../util/null";

import type {NodeAddressT} from "../../core/graph";
import type {Connection} from "../../core/attribution/graphToMarkovChain";
import type {ScoredConnection} from "../../analysis/pagerankNodeDecomposition";
import {DynamicExplorerAdapterSet} from "../adapters/explorerAdapterSet";
import {TableRow} from "./TableRow";
import {NodeRow} from "./Node";

import {edgeVerb, nodeDescription, type SharedProps, Badge} from "./shared";

type ConnectionRowListProps = {|
  +depth: number,
  +node: NodeAddressT,
  +sharedProps: SharedProps,
  +connections: $ReadOnlyArray<ScoredConnection>,
|};

export class ConnectionRowList extends React.PureComponent<ConnectionRowListProps> {
  render() {
    const {depth, node, sharedProps, connections} = this.props;
    const {maxEntriesPerList} = sharedProps;
    return (
      <React.Fragment>
        {connections.slice(0, maxEntriesPerList).map((sc) => (
          <ConnectionRow
            key={JSON.stringify(sc.connection.adjacency)}
            depth={depth}
            target={node}
            scoredConnection={sc}
            sharedProps={sharedProps}
          />
        ))}
      </React.Fragment>
    );
  }
}

type ConnectionRowProps = {|
  +depth: number,
  +target: NodeAddressT,
  +scoredConnection: ScoredConnection,
  +sharedProps: SharedProps,
|};

export class ConnectionRow extends React.PureComponent<ConnectionRowProps> {
  render() {
    const {
      sharedProps,
      target,
      depth,
      scoredConnection: {connection, source, connectionScore},
    } = this.props;
    const {pnd, adapters} = sharedProps;
    const {score: targetScore} = NullUtil.get(pnd.get(target));
    const connectionProportion = connectionScore / targetScore;
    const connectionPercent = (connectionProportion * 100).toFixed(2) + "%";

    const connectionView = (
      <ConnectionView connection={connection} adapters={adapters} />
    );
    return (
      <TableRow
        indent={2}
        depth={depth}
        description={connectionView}
        multiuseColumn={connectionPercent}
        showPadding={false}
        cred={connectionScore}
      >
        <NodeRow
          depth={depth + 1}
          showPadding={true}
          node={source}
          sharedProps={sharedProps}
        />
      </TableRow>
    );
  }
}

export class ConnectionView extends React.PureComponent<{|
  +connection: Connection,
  +adapters: DynamicExplorerAdapterSet,
|}> {
  render() {
    const {connection, adapters} = this.props;
    const {adjacency} = connection;
    switch (adjacency.type) {
      case "SYNTHETIC_LOOP":
        return <Badge>synthetic loop</Badge>;
      case "IN_EDGE":
        return (
          <span>
            <Badge>
              {edgeVerb(adjacency.edge.address, "BACKWARD", adapters)}
            </Badge>{" "}
            <span>{nodeDescription(adjacency.edge.src, adapters)}</span>
          </span>
        );
      case "OUT_EDGE":
        return (
          <span>
            <Badge>
              {edgeVerb(adjacency.edge.address, "FORWARD", adapters)}
            </Badge>{" "}
            <span>{nodeDescription(adjacency.edge.dst, adapters)}</span>
          </span>
        );
      default:
        throw new Error((adjacency.type: empty));
    }
  }
}
