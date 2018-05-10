// @flow

import React from "react";
import stringify from "json-stable-stringify";

import {Graph} from "../../core/graph";
import {PLUGIN_NAME as GITHUB_PLUGIN_NAME} from "../../plugins/github/pluginName";
import {GIT_PLUGIN_NAME} from "../../plugins/git/types";
import {nodeDescription as githubNodeDescription} from "../../plugins/github/render";
import {nodeDescription as gitNodeDescription} from "../../plugins/git/render";
import type {PagerankResult} from "./basicPagerank";

type Props = {
  pagerankResult: ?PagerankResult,
  graph: ?Graph<any, any>,
};

type State = {
  typeFilter: ?{|
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
    this.state = {typeFilter: null};
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
          value={JSON.stringify(this.state.typeFilter)}
          onChange={(e) => {
            this.setState({typeFilter: JSON.parse(e.target.value)});
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
          this.state.typeFilter
            ? n.address.pluginName === this.state.typeFilter.pluginName &&
              n.address.type === this.state.typeFilter.type
            : true
      )
      .sort((a, b) => {
        const x = pagerankResult.get(a.address).probability;
        const y = pagerankResult.get(b.address).probability;
        return x - y;
      })
      .reverse();
    return (
      <table>
        <thead>
          <tr>
            <th>Score</th>
            <th>LogScore</th>
            <th>Node</th>
          </tr>
        </thead>
        <tbody>
          {nodesByScore.map((node) => {
            const score = pagerankResult.get(node.address).probability;
            return (
              <tr key={JSON.stringify(node.address)}>
                <td>{(score * 100).toPrecision(3)}</td>
                <td>{Math.log(score).toPrecision(3)}</td>
                <td>{nodeDescription(graph, node.address)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    );
  }
}
