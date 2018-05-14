// @flow

import React from "react";

import type {Node} from "@/core/graph";
import {AdapterSet} from "./adapterSet";
import {Graph} from "@/core/graph";

type Props = {
  graph: ?Graph<any, any>,
  adapters: AdapterSet,
};
type State = {
  typeFilter: ?{|
    +pluginName: string,
    +type: string,
  |},
};

export class ContributionList extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = {
      typeFilter: null,
    };
  }

  render() {
    return (
      <div>
        <h2>Contributions</h2>
        {this.renderFilterSelect()}
        {this.renderTable()}
      </div>
    );
  }

  renderFilterSelect() {
    if (this.props.graph == null) {
      return null;
    }
    const graph: Graph<any, any> = this.props.graph;
    const typesByPlugin: {[pluginName: string]: Set<string>} = {};
    graph.nodes().forEach((node) => {
      const adapter = this.props.adapters.getAdapter(node);
      if (adapter == null) {
        return;
      }
      if (!typesByPlugin[adapter.pluginName]) {
        typesByPlugin[adapter.pluginName] = new Set();
      }
      typesByPlugin[adapter.pluginName].add(node.address.type);
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
    if (this.props.graph == null) {
      return <div>(no graph)</div>;
    } else {
      const graph: Graph<any, any> = this.props.graph;
      const {typeFilter} = this.state;
      const shouldDisplay: (node: Node<any>) => boolean = typeFilter
        ? (node) => {
            const adapter = this.props.adapters.getAdapter(node);
            return (
              !!adapter &&
              adapter.pluginName === typeFilter.pluginName &&
              node.address.type === typeFilter.type
            );
          }
        : (_) => true;
      return (
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Artifact</th>
              <th>Weight</th>
            </tr>
          </thead>
          <tbody>
            {this.props.graph.nodes().map((node) => {
              if (!shouldDisplay(node)) {
                return null;
              }
              const adapter = this.props.adapters.getAdapter(node);
              if (adapter == null) {
                return (
                  <tr key={JSON.stringify(node.address)}>
                    <td colSpan={3}>
                      <i>unknown</i> (plugin: {node.address.pluginName})
                    </td>
                  </tr>
                );
              } else {
                return (
                  <tr key={JSON.stringify(node.address)}>
                    <td>{adapter.extractTitle(graph, node)}</td>
                    <td>[TODO]</td>
                    <td>[TODO]</td>
                  </tr>
                );
              }
            })}
          </tbody>
        </table>
      );
    }
  }
}
