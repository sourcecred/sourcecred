// @flow

import React from "react";
import sortBy from "lodash.sortby";

import {WeightConfig} from "../weights/WeightConfig";
import {NodeAddress, type NodeAddressT} from "../../core/graph";
import type {PagerankNodeDecomposition} from "../../analysis/pagerankNodeDecomposition";
import {DynamicExplorerAdapterSet} from "../adapters/explorerAdapterSet";
import type {DynamicExplorerAdapter} from "../adapters/explorerAdapter";
import {NodeRowList} from "./Node";
import {type NodeType} from "../../analysis/types";

type PagerankTableProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: DynamicExplorerAdapterSet,
  +maxEntriesPerList: number,
  +defaultNodeType: ?NodeType,
  +manualWeights: Map<NodeAddressT, number>,
  +onManualWeightsChange: (NodeAddressT, number) => void,
  +weightConfig: React$Element<typeof WeightConfig>,
|};
type PagerankTableState = {|
  selectedNodeTypePrefix: NodeAddressT,
  showWeightConfig: boolean,
|};
export class PagerankTable extends React.PureComponent<
  PagerankTableProps,
  PagerankTableState
> {
  constructor(props: PagerankTableProps): void {
    super();
    const {defaultNodeType} = props;
    const selectedNodeTypePrefix =
      defaultNodeType != null ? defaultNodeType.prefix : NodeAddress.empty;
    this.state = {
      selectedNodeTypePrefix,
      showWeightConfig: false,
    };
  }

  renderConfigurationRow() {
    const {showWeightConfig} = this.state;
    return (
      <div style={{display: "flex"}}>
        {this.renderFilterSelect()}
        <span style={{flexGrow: 1}} />
        <button
          onClick={() => {
            this.setState(({showWeightConfig}) => ({
              showWeightConfig: !showWeightConfig,
            }));
          }}
        >
          {showWeightConfig
            ? "Hide weight configuration"
            : "Show weight configuration"}
        </button>
      </div>
    );
  }

  render() {
    const {showWeightConfig} = this.state;
    return (
      <div style={{marginTop: 10}}>
        {this.renderConfigurationRow()}
        {showWeightConfig && this.props.weightConfig}
        {this.renderTable()}
      </div>
    );
  }

  renderFilterSelect() {
    const {pnd, adapters} = this.props;
    if (pnd == null || adapters == null) {
      throw new Error("Impossible.");
    }

    function optionGroup(adapter: DynamicExplorerAdapter) {
      const header = (
        <option
          key={adapter.static().declaration().nodePrefix}
          value={adapter.static().declaration().nodePrefix}
          style={{fontWeight: "bold"}}
        >
          {adapter.static().declaration().name}
        </option>
      );
      const entries = adapter
        .static()
        .declaration()
        .nodeTypes.map((type) => (
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
          value={this.state.selectedNodeTypePrefix}
          onChange={(e) =>
            this.setState({selectedNodeTypePrefix: e.target.value})
          }
        >
          <option value={NodeAddress.empty}>Show all</option>
          {sortBy(
            adapters.adapters(),
            (a: DynamicExplorerAdapter) => a.static().declaration().name
          ).map(optionGroup)}
        </select>
      </label>
    );
  }

  renderTable() {
    const {
      pnd,
      adapters,
      maxEntriesPerList,
      manualWeights,
      onManualWeightsChange,
    } = this.props;
    if (pnd == null || adapters == null || maxEntriesPerList == null) {
      throw new Error("Impossible.");
    }
    const sharedProps = {
      pnd,
      adapters,
      maxEntriesPerList,
      manualWeights,
      onManualWeightsChange,
    };
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
            <th style={{textAlign: "right"}} />
            <th style={{textAlign: "right"}}>Cred</th>
          </tr>
        </thead>
        <tbody>
          <NodeRowList
            sharedProps={sharedProps}
            nodes={Array.from(pnd.keys()).filter((node) =>
              NodeAddress.hasPrefix(node, this.state.selectedNodeTypePrefix)
            )}
          />
        </tbody>
      </table>
    );
  }
}
