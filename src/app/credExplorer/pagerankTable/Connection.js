// @flow

import React from "react";
import * as NullUtil from "../../../util/null";

import type {NodeAddressT} from "../../../core/graph";
import type {Connection} from "../../../core/attribution/graphToMarkovChain";
import type {ScoredConnection} from "../../../core/attribution/pagerankNodeDecomposition";
import type {DynamicPluginAdapter} from "../../pluginAdapter";

import {
  edgeVerb,
  nodeDescription,
  scoreDisplay,
  type SharedProps,
  type RowState,
} from "./shared";

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

export class ConnectionRow extends React.PureComponent<
  ConnectionRowProps,
  RowState
> {
  constructor() {
    super();
    this.state = {expanded: false};
  }
  render() {
    const {
      sharedProps,
      target,
      depth,
      scoredConnection: {connection, source, sourceScore, connectionScore},
    } = this.props;
    const {pnd, adapters} = sharedProps;
    const {expanded} = this.state;
    const {score: targetScore} = NullUtil.get(pnd.get(target));
    const connectionProportion = connectionScore / targetScore;
    const connectionPercent = (connectionProportion * 100).toFixed(2);

    return (
      <React.Fragment>
        <tr
          key="self"
          style={{backgroundColor: `rgba(0,143.4375,0,${1 - 0.9 ** depth})`}}
        >
          <td style={{display: "flex", alignItems: "flex-start"}}>
            <button
              style={{
                marginRight: 5,
                marginLeft: 15 * depth,
              }}
              onClick={() => {
                this.setState(({expanded}) => ({
                  expanded: !expanded,
                }));
              }}
            >
              {expanded ? "\u2212" : "+"}
            </button>
            <ConnectionView connection={connection} adapters={adapters} />
          </td>
          <td style={{textAlign: "right"}}>{connectionPercent}%</td>
          <td style={{textAlign: "right"}}>{scoreDisplay(sourceScore)}</td>
        </tr>
        {expanded && (
          <ConnectionRowList
            key="children"
            depth={depth + 1}
            node={source}
            sharedProps={sharedProps}
          />
        )}
      </React.Fragment>
    );
  }
}

export class ConnectionView extends React.PureComponent<{|
  +connection: Connection,
  +adapters: $ReadOnlyArray<DynamicPluginAdapter>,
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
