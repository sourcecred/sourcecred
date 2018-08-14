// @flow

import React from "react";
import sortBy from "lodash.sortby";
import * as NullUtil from "../../../util/null";

import {type NodeAddressT} from "../../../core/graph";
import {TableRow} from "./TableRow";

import {nodeDescription, type SharedProps} from "./shared";

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
            <NodeRow
              showPadding={false}
              depth={0}
              node={node}
              key={node}
              sharedProps={sharedProps}
            />
          ))}
      </React.Fragment>
    );
  }
}

export type NodeRowProps = {|
  +depth: number,
  +node: NodeAddressT,
  +sharedProps: SharedProps,
  +showPadding: boolean,
|};

export class NodeRow extends React.PureComponent<NodeRowProps> {
  render() {
    const {depth, node, sharedProps, showPadding} = this.props;
    const {pnd, adapters} = sharedProps;
    const {score} = NullUtil.get(pnd.get(node));
    const description = <span>{nodeDescription(node, adapters)}</span>;
    return (
      <TableRow
        depth={depth}
        indent={0}
        showPadding={showPadding}
        description={description}
        connectionProportion={null}
        score={score}
      >
        <ConnectionRowList
          depth={depth}
          node={node}
          sharedProps={sharedProps}
        />
      </TableRow>
    );
  }
}
