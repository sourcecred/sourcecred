// @flow

import sortBy from "lodash.sortby";
import React from "react";

import {
  type EdgeAddressT,
  type NodeAddressT,
  NodeAddress,
} from "../../core/graph";
import type {
  PagerankNodeDecomposition,
  ScoredConnection,
} from "../../core/attribution/pagerankNodeDecomposition";
import type {Connection} from "../../core/attribution/graphToMarkovChain";
import {
  type DynamicPluginAdapter,
  dynamicDispatchByNode,
  dynamicDispatchByEdge,
  findEdgeType,
} from "../pluginAdapter";
import * as NullUtil from "../../util/null";

export function nodeDescription(
  address: NodeAddressT,
  adapters: $ReadOnlyArray<DynamicPluginAdapter>
): string {
  const adapter = dynamicDispatchByNode(adapters, address);
  try {
    return adapter.nodeDescription(address);
  } catch (e) {
    const result = NodeAddress.toString(address);
    console.error(`Error getting description for ${result}: ${e.message}`);
    return result;
  }
}

function edgeVerb(
  address: EdgeAddressT,
  direction: "FORWARD" | "BACKWARD",
  adapters: $ReadOnlyArray<DynamicPluginAdapter>
): string {
  const adapter = dynamicDispatchByEdge(adapters, address);
  const edgeType = findEdgeType(adapter.static(), address);
  return direction === "FORWARD" ? edgeType.forwardName : edgeType.backwardName;
}

function scoreDisplay(probability: number) {
  return (-1 * Math.log(probability)).toFixed(2);
}

type SharedProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: $ReadOnlyArray<DynamicPluginAdapter>,
  +maxEntriesPerList: number,
|};

type PagerankTableProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: $ReadOnlyArray<DynamicPluginAdapter>,
  +maxEntriesPerList: number,
|};
type PagerankTableState = {|topLevelFilter: NodeAddressT|};
export class PagerankTable extends React.PureComponent<
  PagerankTableProps,
  PagerankTableState
> {
  constructor() {
    super();
    this.state = {topLevelFilter: NodeAddress.empty};
  }

  render() {
    return (
      <div style={{marginTop: 10}}>
        {this.renderFilterSelect()}
        {this.renderTable()}
      </div>
    );
  }

  renderFilterSelect() {
    const {pnd, adapters} = this.props;
    if (pnd == null || adapters == null) {
      throw new Error("Impossible.");
    }

    function optionGroup(adapter: DynamicPluginAdapter) {
      const header = (
        <option
          key={adapter.static().nodePrefix()}
          value={adapter.static().nodePrefix()}
          style={{fontWeight: "bold"}}
        >
          {adapter.static().name()}
        </option>
      );
      const entries = adapter
        .static()
        .nodeTypes()
        .map((type) => (
          <option key={type.prefix} value={type.prefix}>
            {"\u2003" + type.name}
          </option>
        ));
      return [header, ...entries];
    }
    return (
      <label>
        <span>Filter by node type: </span>
        <select
          value={this.state.topLevelFilter}
          onChange={(e) => {
            this.setState({topLevelFilter: e.target.value});
          }}
        >
          <option value={NodeAddress.empty}>Show all</option>
          {sortBy(adapters, (a: DynamicPluginAdapter) => a.static().name()).map(
            optionGroup
          )}
        </select>
      </label>
    );
  }

  renderTable() {
    const {pnd, adapters, maxEntriesPerList} = this.props;
    if (pnd == null || adapters == null || maxEntriesPerList == null) {
      throw new Error("Impossible.");
    }
    const topLevelFilter = this.state.topLevelFilter;
    const sharedProps = {pnd, adapters, maxEntriesPerList};
    return (
      <table
        style={{
          borderCollapse: "collapse",
          marginTop: 10,
          // If we don't subtract 1px here, then a horizontal scrollbar
          // appears in Chrome (but not Firefox). I'm not sure why.
          width: "calc(100% - 1px)",
        }}
      >
        <thead>
          <tr>
            <th style={{textAlign: "left"}}>Description</th>
            <th style={{textAlign: "right"}}>Connection</th>
            <th style={{textAlign: "right"}}>Score</th>
          </tr>
        </thead>
        <tbody>
          <NodeRowList
            sharedProps={sharedProps}
            nodes={Array.from(pnd.keys()).filter((node) =>
              NodeAddress.hasPrefix(node, topLevelFilter)
            )}
          />
        </tbody>
      </table>
    );
  }
}

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
        {sortBy(nodes, (n) => -NullUtil.get(pnd.get(n)).score, (n) => n)
          .slice(0, maxEntriesPerList)
          .map((node) => (
            <NodeRow node={node} key={node} sharedProps={sharedProps} />
          ))}
      </React.Fragment>
    );
  }
}

type RowState = {|
  expanded: boolean,
|};

type NodeRowProps = {|
  +node: NodeAddressT,
  +sharedProps: SharedProps,
|};

export class NodeRow extends React.PureComponent<NodeRowProps, RowState> {
  constructor() {
    super();
    this.state = {expanded: false};
  }
  render() {
    const {node, sharedProps} = this.props;
    const {pnd, adapters} = sharedProps;
    const {expanded} = this.state;
    const {score} = NullUtil.get(pnd.get(node));
    return (
      <React.Fragment>
        <tr key="self">
          <td style={{display: "flex", alignItems: "flex-start"}}>
            <button
              style={{marginRight: 5}}
              onClick={() => {
                this.setState(({expanded}) => ({
                  expanded: !expanded,
                }));
              }}
            >
              {expanded ? "\u2212" : "+"}
            </button>
            <span>{nodeDescription(node, adapters)}</span>
          </td>
          <td style={{textAlign: "right"}}>{"—"}</td>
          <td style={{textAlign: "right"}}>{scoreDisplay(score)}</td>
        </tr>
        {expanded && (
          <ConnectionRowList
            key="children"
            depth={1}
            node={node}
            sharedProps={sharedProps}
          />
        )}
      </React.Fragment>
    );
  }
}

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
