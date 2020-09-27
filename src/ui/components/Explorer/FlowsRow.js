// @flow
import React from "react";
import sortBy from "../../../util/sortBy";
import CredRow from "./CredRow";
import NodeRow from "./NodeRow";
import {
  CredView,
  type CredNode,
  type Flow,
  type EdgeFlow,
} from "../../../analysis/credView";

const edgeDescription = ({neighbor, edge}: EdgeFlow) => {
  const type = edge.type;
  const forwards = neighbor.address === edge.dst.address;
  let name = "Unknown edge to";
  if (type != null) {
    name = forwards ? type.forwardName : type.backwardName;
  }
  return name + " " + neighbor.description;
};

const FlowRow = (view: CredView, f: Flow, total: number, depth: number) => {
  const key = (f) => (f.type === "EDGE" ? f.edge.address : f.type);
  const description = (() => {
    switch (f.type) {
      case "RADIATE":
        return "Radiation To Seed";
      case "EDGE":
        return edgeDescription(f);
      case "MINT":
        return "Mint from Seed";
      case "SYNTHETIC_LOOP":
        return "Synthetic self-loop";
      case "DEPENDENCY_MINT":
        return "Dependency Minted Cred";
      default:
        throw new Error((f.type: empty));
    }
  })();

  const children = [];
  if (f.type === "EDGE") {
    const nodeRow = (
      <NodeRow
        key={"node"}
        view={view}
        node={f.neighbor}
        total={f.neighbor.credSummary.cred}
        depth={depth + 1}
        showChart={false}
      />
    );
    children.push(nodeRow);
  }

  return (
    <CredRow
      key={key(f)}
      description={description}
      cred={f.flow}
      total={total}
      data={null}
      depth={depth}
      indent={1}
    >
      {children}
    </CredRow>
  );
};

const FlowsRow = ({
  view,
  node,
  depth,
}: {|
  +view: CredView,
  +node: CredNode,
  +depth: number,
|}) => {
  const inflows = view.inflows(node.address);
  if (inflows == null) {
    throw new Error("no flows");
  }

  const sortedFlows = sortBy(inflows, (x) => -x.flow);
  return (
    <>
      {sortedFlows
        .slice(0, 10)
        .map((f) => FlowRow(view, f, node.credSummary.cred, depth))}
    </>
  );
};

export default FlowsRow;
