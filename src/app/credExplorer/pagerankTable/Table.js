// @flow

import React from "react";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../../util/null";

import {type NodeAddressT, NodeAddress} from "../../../core/graph";
import type {PagerankNodeDecomposition} from "../../../analysis/pagerankNodeDecomposition";
import {DynamicAdapterSet} from "../../adapters/adapterSet";
import type {DynamicAppAdapter} from "../../adapters/appAdapter";
import {FALLBACK_NAME} from "../../../analysis/fallbackDeclaration";
import type {WeightedTypes} from "../../../analysis/weights";
import {WeightConfig} from "../weights/WeightConfig";

import {NodeRowList} from "./Node";

type PagerankTableProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: DynamicAdapterSet,
  +weightedTypes: WeightedTypes,
  +onWeightedTypesChange: (WeightedTypes) => void,
  +maxEntriesPerList: number,
  +defaultNodeFilter: ?NodeAddressT,
|};
type PagerankTableState = {|
  topLevelFilter: NodeAddressT,
  showWeightConfig: boolean,
|};
export class PagerankTable extends React.PureComponent<
  PagerankTableProps,
  PagerankTableState
> {
  constructor(props: PagerankTableProps): void {
    super();
    const {defaultNodeFilter, adapters} = props;
    if (defaultNodeFilter != null) {
      const nodeTypes = adapters.static().nodeTypes();
      if (!nodeTypes.some((x) => x.prefix === defaultNodeFilter)) {
        throw new Error(
          `invalid defaultNodeFilter ${defaultNodeFilter}: doesn't match any type`
        );
      }
    }
    const topLevelFilter = NullUtil.orElse(
      props.defaultNodeFilter,
      NodeAddress.empty
    );
    this.state = {topLevelFilter, showWeightConfig: false};
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
        {showWeightConfig && (
          <WeightConfig
            adapters={this.props.adapters.static()}
            weightedTypes={this.props.weightedTypes}
            onChange={(wt) => this.props.onWeightedTypesChange(wt)}
          />
        )}
        {this.renderTable()}
      </div>
    );
  }

  renderFilterSelect() {
    const {pnd, adapters} = this.props;
    if (pnd == null || adapters == null) {
      throw new Error("Impossible.");
    }

    function optionGroup(adapter: DynamicAppAdapter) {
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
          value={this.state.topLevelFilter}
          onChange={(e) => {
            this.setState({topLevelFilter: e.target.value});
          }}
        >
          <option value={NodeAddress.empty}>Show all</option>
          {sortBy(
            adapters.adapters(),
            (a: DynamicAppAdapter) => a.static().declaration().name
          )
            .filter((a) => a.static().declaration().name !== FALLBACK_NAME)
            .map(optionGroup)}
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
            <th style={{textAlign: "right"}} />
            <th style={{textAlign: "right"}}>Cred</th>
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
