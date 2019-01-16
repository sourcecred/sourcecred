// @flow

import {
  type WeightedTypes,
  combineWeights,
  defaultWeightsForDeclaration,
} from "../../analysis/weights";
import type {StaticExplorerAdapter} from "../adapters/explorerAdapter";
import type {StaticExplorerAdapterSet} from "../adapters/explorerAdapterSet";

export function defaultWeightsForAdapter(
  adapter: StaticExplorerAdapter
): WeightedTypes {
  return defaultWeightsForDeclaration(adapter.declaration());
}

export function defaultWeightsForAdapterSet(
  adapters: StaticExplorerAdapterSet
): WeightedTypes {
  return combineWeights(adapters.adapters().map(defaultWeightsForAdapter));
}
