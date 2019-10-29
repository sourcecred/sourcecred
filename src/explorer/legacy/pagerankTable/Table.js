// @flow

import React from "react";
import sortBy from "lodash.sortby";

import {WeightConfig} from "../../weights/WeightConfig";
import {WeightsFileManager} from "../../weights/WeightsFileManager";
import {Graph, NodeAddress, type NodeAddressT} from "../../../core/graph";
import type {PagerankNodeDecomposition} from "../../../analysis/pagerankNodeDecomposition";
import {NodeRowList} from "./Node";
import {type PluginDeclaration} from "../../../analysis/pluginDeclaration";

type PagerankTableProps = {|
  +pnd: PagerankNodeDecomposition,
  +declarations: $ReadOnlyArray<PluginDeclaration>,
  +graph: Graph,
  +maxEntriesPerList: number,
  +manualWeights: Map<NodeAddressT, number>,
  +onManualWeightsChange: (NodeAddressT, number) => void,
  +weightConfig: React$Element<typeof WeightConfig>,
  +weightFileManager: React$Element<typeof WeightsFileManager>,
|};
type PagerankTableState = {|
  selectedNodeTypePrefix: NodeAddressT | null,
  showWeightConfig: boolean,
|};
export class PagerankTable extends React.PureComponent<
  PagerankTableProps,
  PagerankTableState
> {
  constructor(): void {
    super();
    this.state = {
      selectedNodeTypePrefix: null,
      showWeightConfig: false,
    };
  }

  renderConfigurationRow() {
    const {showWeightConfig} = this.state;
    return (
      <div style={{display: "flex"}}>
        {this.renderFilterSelect()}
        <span style={{flexGrow: 1}} />
        {this.props.weightFileManager}
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
    const {pnd, declarations} = this.props;
    if (pnd == null || declarations == null) {
      throw new Error("Impossible.");
    }

    function optionGroup(declaration: PluginDeclaration) {
      const header = (
        <option
          key={declaration.nodePrefix}
          value={declaration.nodePrefix}
          style={{fontWeight: "bold"}}
        >
          {declaration.name}
        </option>
      );
      const entries = declaration.nodeTypes.map((type) => (
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
          {sortBy(declarations, (d: PluginDeclaration) => d.name).map(
            optionGroup
          )}
        </select>
      </label>
    );
  }

  renderTable() {
    const {
      pnd,
      declarations,
      maxEntriesPerList,
      manualWeights,
      onManualWeightsChange,
      graph,
    } = this.props;
    if (pnd == null || declarations == null || maxEntriesPerList == null) {
      throw new Error("Impossible.");
    }
    const sharedProps = {
      pnd,
      declarations,
      maxEntriesPerList,
      manualWeights,
      onManualWeightsChange,
      graph,
    };
    const userTypes = [].concat(...declarations.map((p) => p.userTypes));
    const userPrefixes = userTypes.map((x) => x.prefix);
    const filterAllUsers = (n) =>
      userPrefixes.some((p) => NodeAddress.hasPrefix(n, p));
    const {selectedNodeTypePrefix} = this.state;
    const nodeFilter =
      selectedNodeTypePrefix == null
        ? filterAllUsers
        : (n) => NodeAddress.hasPrefix(n, selectedNodeTypePrefix);
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
            nodes={Array.from(pnd.keys()).filter(nodeFilter)}
          />
        </tbody>
      </table>
    );
  }
}
