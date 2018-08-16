// @flow

import React from "react";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../../util/null";

import {type NodeAddressT, NodeAddress} from "../../../core/graph";
import type {PagerankNodeDecomposition} from "../../../core/attribution/pagerankNodeDecomposition";
import {DynamicAdapterSet} from "../../adapters/adapterSet";
import type {DynamicPluginAdapter} from "../../adapters/pluginAdapter";
import {FALLBACK_NAME} from "../../adapters/fallbackAdapter";

import {NodeRowList} from "./Node";

type PagerankTableProps = {|
  +pnd: PagerankNodeDecomposition,
  +adapters: DynamicAdapterSet,
  +maxEntriesPerList: number,
  +defaultNodeFilter: ?NodeAddressT,
|};
type PagerankTableState = {|topLevelFilter: NodeAddressT|};
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
    this.state = {topLevelFilter};
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
          {sortBy(adapters.adapters(), (a: DynamicPluginAdapter) =>
            a.static().name()
          )
            .filter((a) => a.static().name() !== FALLBACK_NAME)
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
