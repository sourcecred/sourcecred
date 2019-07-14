// @flow

import React from "react";

import {type NodeAddressT} from "../../../core/graph";
import {pagerank} from "../../../analysis/pagerank";
import {graph as demoGraph} from "../../../plugins/demo/graph";
import {declaration as demoDeclaration} from "../../../plugins/demo/declaration";
import type {SharedProps} from "./shared";

export const COLUMNS = () => ["Description", "", "Cred"];

export async function example() {
  const graph = demoGraph();
  const declarations = [demoDeclaration];
  const pnd = await pagerank(graph, (_unused_Edge) => ({
    forwards: 1,
    backwards: 1,
  }));
  const maxEntriesPerList = 123;
  const manualWeights: Map<NodeAddressT, number> = new Map();
  const onManualWeightsChange: (NodeAddressT, number) => void = jest.fn();
  const weightConfig: any = <div data-test-weight-config={true} />;
  const weightFileManager: any = <div data-test-weight-file-manager={true} />;

  const sharedProps: SharedProps = {
    graph,
    declarations,
    pnd,
    maxEntriesPerList,
    manualWeights,
    onManualWeightsChange,
  };

  return {
    pnd,
    maxEntriesPerList,
    sharedProps,
    manualWeights,
    onManualWeightsChange,
    weightConfig,
    weightFileManager,
  };
}
