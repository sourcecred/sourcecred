// @flow

import {
  type WeightedTypes,
  combineWeights,
  defaultWeightsForDeclaration,
} from "../../analysis/weights";
import type {StaticAppAdapter} from "../adapters/appAdapter";
import type {StaticAdapterSet} from "../adapters/adapterSet";

export function defaultWeightsForAdapter(
  adapter: StaticAppAdapter
): WeightedTypes {
  return defaultWeightsForDeclaration(adapter.declaration());
}

export function defaultWeightsForAdapterSet(
  adapters: StaticAdapterSet
): WeightedTypes {
  return combineWeights(adapters.adapters().map(defaultWeightsForAdapter));
}
