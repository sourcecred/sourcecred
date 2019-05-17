// @flow

import {type NodeAddressT} from "../../core/graph";
import {pagerank} from "../../analysis/pagerank";
import type {WeightedTypes} from "../../analysis/weights";
import {defaultWeightsForAdapterSet} from "../weights/weights";
import {dynamicExplorerAdapterSet} from "../../plugins/demo/explorerAdapter";
import type {SharedProps} from "./shared";

export const COLUMNS = () => ["Description", "", "Cred"];

export async function example() {
  const adapters = await dynamicExplorerAdapterSet();
  const weightedTypes = defaultWeightsForAdapterSet(adapters.static());
  const graph = adapters.graph();
  const pnd = await pagerank(graph, (_unused_Edge) => ({
    toWeight: 1,
    froWeight: 1,
  }));
  const maxEntriesPerList = 123;
  const manualWeights: Map<NodeAddressT, number> = new Map();
  const onManualWeightsChange: (NodeAddressT, number) => void = jest.fn();
  const onWeightedTypesChange: (WeightedTypes) => void = jest.fn();

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
    weightedTypes,
    maxEntriesPerList,
    sharedProps,
    manualWeights,
    onManualWeightsChange,
    onWeightedTypesChange,
  };
}
