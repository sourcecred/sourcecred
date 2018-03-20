// @flow

import React from "react";

import type {Address} from "../../../core/address";
import {AdapterSet} from "./adapterSet";
import {Graph} from "../../../core/graph";

type Props = {
  graph: ?Graph<any, any>,
  adapters: AdapterSet,
};
type State = {};

export class ContributionList extends React.Component<Props, State> {
  render() {
    return (
      <div>
        <h2>Contributions</h2>
        {this.renderTable()}
      </div>
    );
  }

  renderTable() {
    if (this.props.graph == null) {
      return <div>(no graph)</div>;
    } else {
      const graph: Graph<any, any> = this.props.graph;
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
            {this.props.graph.getAllNodes().map((node) => {
              const adapter = this.props.adapters.getAdapter(node);
              if (adapter == null) {
                return (
                  <tr>
                    <td colspan={3}>
                      <i>unknown</i> (plugin: {node.address.pluginName})
                    </td>
                  </tr>
                );
              } else {
                return (
                  <tr>
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
