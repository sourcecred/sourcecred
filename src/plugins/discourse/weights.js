// @flow

import {type NodeWeight} from "../../core/weights";
import * as C from "../../util/combo";
import * as NullUtil from "../../util/null";
import {DEFAULT_TRUST_LEVEL_TO_WEIGHT} from "./createGraph";
import {type User} from "./fetch";

type WeightConfig = {|
  [string]: NodeWeight,
|};
export type SerializedConfig = {|
  +defaultWeight?: NodeWeight,
  +weights?: WeightConfig,
|};

type TagWeights = Map<string, NodeWeight>;

export type TagConfig = {|
  +defaultWeight: NodeWeight,
  +weights: TagWeights,
|};

type CategoryWeights = Map<number, NodeWeight>;

export type CategoryConfig = {|
  +defaultWeight: NodeWeight,
  +weights: CategoryWeights,
|};

export function upgradeCategories(c: SerializedConfig): CategoryConfig {
  const newConfig = {
    defaultWeight: NullUtil.orElse(c.defaultWeight, 1),
    weights: new Map(),
  };
  if (c.weights) {
    const mapWeights = Object.entries(c.weights).map(
      ([categoryString, weight]) => [
        parseInt(categoryString, 10),
        // needed to satisfy flow here, or it enforces "mixed" type
        parseInt(weight, 10),
      ]
    );
    newConfig.weights = new Map(mapWeights);
  }

  return newConfig;
}

export function upgradeTags(c: SerializedConfig): TagConfig {
  const newConfig = {
    defaultWeight: NullUtil.orElse(c.defaultWeight, 1),
    weights: new Map(),
  };
  if (c.weights) {
    const mapWeights = Object.entries(c.weights).map(([tag, weight]) => [
      tag,
      // needed to satisfy flow here, or it enforces a "mixed" type
      parseInt(weight, 10),
    ]);
    newConfig.weights = new Map(mapWeights);
  }

  return newConfig;
}

export const tagConfigParser: C.Parser<TagConfig> = C.fmap(
  C.object(
    {},
    {
      defaultWeight: C.number,
      weights: C.dict(C.number),
    }
  ),
  upgradeTags
);

// categoryIDs should all be numbers, so the parser verifies that it is
// indeed a number, then return a string since it is a dict key
export function parseCategoryId(id: string): string {
  const result = parseInt(id, 10);
  if (Number.isNaN(result)) {
    throw new Error(`CategoryId should be a number; got ${id}`);
  }
  return id;
}

export const categoryConfigParser: C.Parser<CategoryConfig> = C.fmap(
  C.object(
    {},
    {
      defaultWeight: C.number,
      weights: C.dict(C.number, C.fmap(C.string, parseCategoryId)),
    }
  ),
  upgradeCategories
);

export function likeWeight(user: ?User): NodeWeight {
  if (user == null) {
    return 0;
  }
  return _trustLevelWeight(user.trustLevel);
}

export function _trustLevelWeight(trustLevel: number | null): NodeWeight {
  if (trustLevel == null) {
    // The null trust level shouldn't happen in practice, right now users who
    // only like but never post will have null trust level (will be fixed by #2045).
    // This means they could have trust level 1. But to be conservative, we treat anyone
    // with a null trust level as if they have trust level 0.
    // Possibly this could come up with deleted users too.
    return DEFAULT_TRUST_LEVEL_TO_WEIGHT["0"];
  }

  const key = String(trustLevel);
  const weight = DEFAULT_TRUST_LEVEL_TO_WEIGHT[key];
  if (weight == null) {
    throw new Error(`invalid trust level: ${String(key)}`);
  }
  return weight;
}
