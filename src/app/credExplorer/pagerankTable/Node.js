// @flow

import React from "react";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../../util/null";

import {type NodeAddressT} from "../../../core/graph";

import {
  nodeDescription,
  scoreDisplay,
  type SharedProps,
  type RowState,
} from "./shared";

import {ConnectionRowList} from "./Connection";

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
