// @flow

import sortBy from "lodash.sortby";
import React from "react";

import {
  Graph,
  NodeAddress,
  type NodeAddressT,
  Direction,
  EdgeAddress,
} from "../../core/graph";
import type {PagerankResult} from "../../core/attribution/pagerank";
import type {PluginAdapter} from "../pluginAdapter";

const MAX_TABLE_ENTRIES = 100;

type Props = {
  pagerankResult: ?PagerankResult,
  graph: ?Graph,
  adapters: ?$ReadOnlyArray<PluginAdapter>,
};

type State = {
  topLevelFilter: NodeAddressT,
};

// TODO: Factor this out and test it (#465)
export function nodeDescription(
  address: NodeAddressT,
  adapters: $ReadOnlyArray<PluginAdapter>
): string {
  const adapter = adapters.find((adapter) =>
    NodeAddress.hasPrefix(address, adapter.nodePrefix())
  );
  if (adapter == null) {
    const result = NodeAddress.toString(address);
    console.warn(`No adapter for ${result}`);
    return result;
  }

  try {
    return adapter.renderer().nodeDescription(address);
  } catch (e) {
    const result = NodeAddress.toString(address);
    console.error(`Error getting description for ${result}: ${e.message}`);
    return result;
  }
}

export class PagerankTable extends React.PureComponent<Props, State> {
  constructor() {
    super();
    this.state = {topLevelFilter: NodeAddress.empty};
  }

  render() {
    if (this.props.graph == null || this.props.adapters == null) {
      return <p>You must load a graph before seeing PageRank analysis.</p>;
    }
    if (this.props.pagerankResult == null) {
      return <p>Please run PageRank to see analysis.</p>;
    }
    return (
      <div>
        <h2>Contributions</h2>
        {this.renderFilterSelect()}
        {this.renderTable()}
      </div>
    );
  }

  renderFilterSelect() {
    const {graph, pagerankResult, adapters} = this.props;
    if (graph == null || pagerankResult == null || adapters == null) {
      throw new Error("Impossible.");
    }

    function optionGroup(adapter: PluginAdapter) {
      const header = (
        <option
          key={adapter.nodePrefix()}
          value={adapter.nodePrefix()}
          style={{fontWeight: "bold"}}
        >
          {adapter.name()}
        </option>
      );
      const entries = adapter.nodeTypes().map((type) => (
        <option key={type.prefix} value={type.prefix}>
          {"\u2003" + type.name}
        </option>
      ));
      return [header, ...entries];
    }
    return (
      <label>
        Filter by contribution type:{" "}
        <select
          value={this.state.topLevelFilter}
          onChange={(e) => {
            this.setState({topLevelFilter: e.target.value});
          }}
        >
          <option value={NodeAddress.empty}>Show all</option>
          {sortBy(adapters, (a) => a.name()).map(optionGroup)}
        </select>
      </label>
    );
  }

  renderTable() {
    const {graph, pagerankResult, adapters} = this.props;
    if (graph == null || pagerankResult == null || adapters == null) {
      throw new Error("Impossible.");
    }
    const topLevelFilter = this.state.topLevelFilter;
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
            <th style={{textAlign: "left"}}>Node</th>
            <th style={{textAlign: "right"}}>log(score)</th>
          </tr>
        </thead>
        <tbody>
          <RecursiveTables
            addresses={
              topLevelFilter == null
                ? Array.from(graph.nodes())
                : Array.from(graph.nodes()).filter((node) =>
                    NodeAddress.hasPrefix(node, topLevelFilter)
                  )
            }
            graph={graph}
            pagerankResult={pagerankResult}
            depth={0}
            adapters={adapters}
          />
        </tbody>
      </table>
    );
  }
}

type RTState = {expanded: boolean};
type RTProps = {|
  +address: NodeAddressT,
  +graph: Graph,
  +pagerankResult: PagerankResult,
  +depth: number,
  +adapters: $ReadOnlyArray<PluginAdapter>,
|};

class RecursiveTable extends React.PureComponent<RTProps, RTState> {
  constructor() {
    super();
    this.state = {expanded: false};
  }

  render() {
    const {address, adapters, depth, graph, pagerankResult} = this.props;
    const {expanded} = this.state;
    const probability = pagerankResult.get(address);
    if (probability == null) {
      throw new Error(`no PageRank value for ${NodeAddress.toString(address)}`);
    }
    const modifiedLogScore = Math.log(probability) + 10;
    return [
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
          <span>{nodeDescription(address, adapters)}</span>
        </td>
        <td style={{textAlign: "right"}}>{modifiedLogScore.toFixed(2)}</td>
      </tr>,
      expanded && (
        <RecursiveTables
          key="children"
          addresses={Array.from(
            new Set( // deduplicate same node reached by several edges
              Array.from(
                graph.neighbors(address, {
                  direction: Direction.ANY,
                  nodePrefix: NodeAddress.empty,
                  edgePrefix: EdgeAddress.empty,
                })
              ).map((neighbor) => neighbor.node)
            )
          )}
          graph={graph}
          pagerankResult={pagerankResult}
          depth={depth + 1}
          adapters={adapters}
        />
      ),
    ];
  }
}

type RecursiveTablesProps = {|
  +addresses: $ReadOnlyArray<NodeAddressT>,
  +graph: Graph,
  +pagerankResult: PagerankResult,
  +depth: number,
  +adapters: $ReadOnlyArray<PluginAdapter>,
|};

class RecursiveTables extends React.PureComponent<RecursiveTablesProps> {
  render() {
    const {addresses, graph, pagerankResult, depth, adapters} = this.props;
    return addresses
      .slice()
      .sort((a, b) => {
        const x = pagerankResult.get(a);
        const y = pagerankResult.get(b);
        if (x == null) {
          throw new Error(`No pagerank result for ${NodeAddress.toString(a)}`);
        }
        if (y == null) {
          throw new Error(`No pagerank result for ${NodeAddress.toString(b)}`);
        }
        return y - x;
      })
      .slice(0, MAX_TABLE_ENTRIES)
      .map((address) => (
        <RecursiveTable
          depth={depth}
          address={address}
          graph={graph}
          pagerankResult={pagerankResult}
          key={address}
          adapters={adapters}
        />
      ));
  }
}
