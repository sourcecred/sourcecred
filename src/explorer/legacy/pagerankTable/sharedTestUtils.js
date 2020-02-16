// @flow

import React from "react";

import * as Weights from "../../../core/weights";
import {type NodeAddressT} from "../../../core/graph";
import {pagerank} from "../../../analysis/pagerank";
import {graph as demoGraph} from "../../../plugins/demo/graph";
import {declaration as demoDeclaration} from "../../../plugins/demo/declaration";
import type {SharedProps} from "./shared";

export const COLUMNS = () => ["Description", "", "Cred"];

export async function example() {
  const graph = demoGraph();
  const wg = {graph, weights: Weights.empty()};
  const declarations = [demoDeclaration];
  const pnd = await pagerank(wg);
  const maxEntriesPerList = 123;
  const nodeWeights: Map<NodeAddressT, number> = new Map();
  const onNodeWeightsChange: (NodeAddressT, number) => void = jest.fn();
  const weightConfig: any = <div data-test-weight-config={true} />;
  const weightFileManager: any = <div data-test-weight-file-manager={true} />;

  const sharedProps: SharedProps = {
    graph,
    declarations,
    pnd,
    maxEntriesPerList,
    nodeWeights,
    onNodeWeightsChange,
  };

  return {
    pnd,
    maxEntriesPerList,
    sharedProps,
    nodeWeights,
    onNodeWeightsChange,
    weightConfig,
    weightFileManager,
  };
}
