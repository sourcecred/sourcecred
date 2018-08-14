// @flow

import React from "react";
import * as NullUtil from "../../../util/null";

import type {NodeAddressT} from "../../../core/graph";
import type {Connection} from "../../../core/attribution/graphToMarkovChain";
import type {ScoredConnection} from "../../../core/attribution/pagerankNodeDecomposition";
import {DynamicAdapterSet} from "../../adapters/adapterSet";
import {TableRow} from "./TableRow";
import {NodeRow} from "./Node";

import {edgeVerb, nodeDescription, type SharedProps} from "./shared";

type ConnectionRowListProps = {|
  +depth: number,
  +node: NodeAddressT,
  +sharedProps: SharedProps,
|};

export class ConnectionRowList extends React.PureComponent<
  ConnectionRowListProps
> {
  render() {
    const {depth, node, sharedProps} = this.props;
    const {pnd, maxEntriesPerList} = sharedProps;
    const {scoredConnections} = NullUtil.get(pnd.get(node));
    return (
      <React.Fragment>
        {scoredConnections
          .slice(0, maxEntriesPerList)
          .map((sc) => (
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

    const connectionView = (
      <ConnectionView connection={connection} adapters={adapters} />
    );
    return (
      <TableRow
        indent={1}
        depth={depth}
        description={connectionView}
        connectionProportion={connectionProportion}
        showPadding={false}
        score={connectionScore}
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
  +adapters: DynamicAdapterSet,
|}> {
  render() {
    const {connection, adapters} = this.props;
    function Badge({children}) {
      return (
        // The outer <span> acts as a strut to ensure that the badge
        // takes up a full line height, even though its text is smaller.
        <span>
          <span
            style={{
              textTransform: "uppercase",
              fontWeight: 700,
              fontSize: "smaller",
            }}
          >
            {children}
          </span>
        </span>
      );
    }
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
