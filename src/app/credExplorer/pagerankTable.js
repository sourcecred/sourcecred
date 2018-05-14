// @flow

import React from "react";
import stringify from "json-stable-stringify";

import {Graph} from "@/core/graph";
import type {Address} from "@/core/address";
import {AddressMap} from "@/core/address";
import {PLUGIN_NAME as GITHUB_PLUGIN_NAME} from "@/plugins/github/pluginName";
import {GIT_PLUGIN_NAME} from "@/plugins/git/types";
import {nodeDescription as githubNodeDescription} from "@/plugins/github/render";
import {nodeDescription as gitNodeDescription} from "@/plugins/git/render";
import type {PagerankResult} from "./basicPagerank";

type Props = {
  pagerankResult: ?PagerankResult,
  graph: ?Graph<any, any>,
};

type State = {
  topLevelFilter: ?{|
    +pluginName: string,
    +type: string,
  |},
};

function nodeDescription(graph, address) {
  switch (address.pluginName) {
    case GITHUB_PLUGIN_NAME: {
      return githubNodeDescription(graph, address);
    }
    case GIT_PLUGIN_NAME: {
      return gitNodeDescription(graph, address);
    }
    default: {
      return stringify(address);
    }
  }
}

export class PagerankTable extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = {topLevelFilter: null};
  }

  render() {
    if (this.props.graph == null) {
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
    if (this.props.graph == null || this.props.pagerankResult == null) {
      throw new Error("Impossible.");
    }
    const graph: Graph<any, any> = this.props.graph;
    const typesByPlugin: {[pluginName: string]: Set<string>} = {};
    graph.nodes().forEach((node) => {
      if (!typesByPlugin[node.address.pluginName]) {
        typesByPlugin[node.address.pluginName] = new Set();
      }
      typesByPlugin[node.address.pluginName].add(node.address.type);
    });
    function optionGroup(pluginName: string) {
      const header = (
        <option key={pluginName} disabled style={{fontWeight: "bold"}}>
          {pluginName}
        </option>
      );
      const entries = Array.from(typesByPlugin[pluginName])
        .sort()
        .map((type) => (
          <option key={type} value={JSON.stringify({pluginName, type})}>
            {"\u2003" + type}
          </option>
        ));
      return [header, ...entries];
    }
    return (
      <label>
        Filter by contribution type:{" "}
        <select
          value={JSON.stringify(this.state.topLevelFilter)}
          onChange={(e) => {
            this.setState({topLevelFilter: JSON.parse(e.target.value)});
          }}
        >
          <option value={JSON.stringify(null)}>Show all</option>
          {Object.keys(typesByPlugin)
            .sort()
            .map(optionGroup)}
        </select>
      </label>
    );
  }

  renderTable() {
    if (this.props.graph == null || this.props.pagerankResult == null) {
      throw new Error("Impossible.");
    }
    const {graph, pagerankResult} = this.props;
    const nodesByScore = graph
      .nodes()
      .slice()
      .filter(
        (n) =>
          this.state.topLevelFilter
            ? n.address.pluginName === this.state.topLevelFilter.pluginName &&
              n.address.type === this.state.topLevelFilter.type
            : true
      )
      .sort((a, b) => {
        const x = pagerankResult.get(a.address).probability;
        const y = pagerankResult.get(b.address).probability;
        return y - x;
      });
    return (
      <table style={{borderCollapse: "collapse"}}>
        <thead>
          <tr>
            <th>Node</th>
            <th>Score</th>
            <th>LogScore</th>
          </tr>
        </thead>
        <tbody>
          {nodesByScore.map((node) => (
            <RecursiveTable
              depth={0}
              address={node.address}
              graph={graph}
              pagerankResult={pagerankResult}
              key={stringify(node.address)}
            />
          ))}
        </tbody>
      </table>
    );
  }
}

type RTState = {expanded: boolean};
type RTProps = {|
  +address: Address,
  +graph: Graph<any, any>,
  +pagerankResult: PagerankResult,
  +depth: number,
|};

class RecursiveTable extends React.Component<RTProps, RTState> {
  constructor() {
    super();
    this.state = {expanded: false};
  }

  render() {
    const {address, graph, pagerankResult, depth} = this.props;
    const {expanded} = this.state;
    const score = pagerankResult.get(address).probability;
    return [
      <tr
        key={JSON.stringify(address)}
        style={{backgroundColor: `rgba(255,0,0,${1 - 0.9 ** depth})`}}
      >
        <td>
          <button
            style={{marginRight: 5, marginLeft: 15 * depth}}
            onClick={() => {
              this.setState(({expanded}) => ({
                expanded: !expanded,
              }));
            }}
          >
            {expanded ? "\u2212" : "+"}
          </button>
          {nodeDescription(graph, address)}
        </td>
        <td>{(score * 100).toPrecision(3)}</td>
        <td>{Math.log(score).toPrecision(3)}</td>
      </tr>,
      expanded && this.renderChildren(),
    ];
  }

  renderChildren() {
    const {address, graph, pagerankResult, depth} = this.props;
    const neighborMap = new AddressMap();
    graph.neighborhood(address).forEach(({neighbor}) => {
      neighborMap.add({address: neighbor});
    });
    return neighborMap
      .getAll()
      .sort((a, b) => {
        const x = pagerankResult.get(a.address).probability;
        const y = pagerankResult.get(b.address).probability;
        return y - x;
      })
      .map(({address}) => (
        <RecursiveTable
          depth={depth + 1}
          address={address}
          graph={graph}
          pagerankResult={pagerankResult}
          key={stringify(address)}
        />
      ));
  }
}
