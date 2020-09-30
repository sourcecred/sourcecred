// @flow
import type {Node} from "React";import React from "react";
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

const NodeRow = ({node, total, view, depth, showChart}: NodeRowProps): Node => {
  const {address, description, credSummary, credOverTime} = node;
  const cred = credSummary.cred;
  const credTimeline =
    !showChart || credOverTime == null ? null : credOverTime.cred;
  const children = [
    <FlowsRow key={address} node={node} view={view} depth={depth} />,
  ];

  return (
    <CredRow
      depth={depth}
      indent={0}
      key={address}
      description={description}
      cred={cred}
      total={total}
      data={credTimeline}
    >
      {children}
    </CredRow>
  );
};

export default NodeRow;
