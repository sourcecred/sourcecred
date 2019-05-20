// @flow

import React from "react";

import {type NodeAddressT} from "../../core/graph";
import {pagerank} from "../../analysis/pagerank";
import {dynamicExplorerAdapterSet} from "../../plugins/demo/explorerAdapter";
import type {SharedProps} from "./shared";

export const COLUMNS = () => ["Description", "", "Cred"];

export async function example() {
  const adapters = await dynamicExplorerAdapterSet();
  const graph = adapters.graph();
  const pnd = await pagerank(graph, (_unused_Edge) => ({
    toWeight: 1,
    froWeight: 1,
  }));
  const maxEntriesPerList = 123;
  const manualWeights: Map<NodeAddressT, number> = new Map();
  const onManualWeightsChange: (NodeAddressT, number) => void = jest.fn();
  const weightConfig: any = <div data-test-weight-config={true} />;

  const sharedProps: SharedProps = {
    adapters,
    pnd,
    maxEntriesPerList,
    manualWeights,
    onManualWeightsChange,
  };

  return {
    adapters,
    pnd,
    maxEntriesPerList,
    sharedProps,
    manualWeights,
    onManualWeightsChange,
    weightConfig,
  };
}
