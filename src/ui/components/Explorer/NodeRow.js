// @flow
import React from "react";
import CredRow from "./CredRow";
import FlowsRow from "./FlowsRow";
import {CredView, type CredNode} from "../../../analysis/credView";

type NodeRowProps = {
  +node: CredNode,
  +total: number,
  +view: CredView,
  +depth: number,
  +showChart: boolean,
};

const NodeRow = (props: NodeRowProps) => {
  const {node, total, view, depth, showChart} = props;
  const {credSummary, credOverTime} = node;
  const cred = credSummary.cred;
  const credTimeline =
    !showChart || credOverTime == null ? null : credOverTime.cred;
  const children = [
    <FlowsRow key={node.address} node={node} view={view} depth={depth} />,
  ];
  return (
    <CredRow
      depth={depth}
      indent={0}
      key={node.address}
      description={node.description}
      cred={cred}
      total={total}
      data={credTimeline}
    >
      {children}
    </CredRow>
  );
};

export default NodeRow;
