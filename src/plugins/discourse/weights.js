// @flow

import {type NodeWeight} from "../../core/weights";
import * as C from "../../util/combo";
import * as NullUtil from "../../util/null";
import {orElse as either} from "../../util/null";
import {DEFAULT_TRUST_LEVEL_TO_WEIGHT} from "./createGraph";
import {type User} from "./fetch";

// Expected to be an integer string, like "1" or "123"
export opaque type CategoryId: string = string;
// No restrictions (can be more specific later if we investigate Discourse)
export opaque type TagId: string = string;

export function parseCategoryId(id: string): CategoryId {
  const result = parseInt(id, 10);
  if (Number.isNaN(result)) {
    throw new Error(`CategoryId should be a string integer; got ${id}`);
  }
  return id;
}

export type SerializedWeightsConfig = {|
  +defaultTagWeight?: NodeWeight,
  +tagWeights: {[TagId]: NodeWeight},
  +defaultCategoryWeight?: NodeWeight,
  +categoryWeights: {[CategoryId]: NodeWeight},
|};

export type WeightsConfig = {|
  +defaultTagWeight: number,
  +tagWeights: Map<TagId, number>,
  +defaultCategoryWeight: number,
  +categoryWeights: Map<CategoryId, number>,
|};

function upgrade(s: SerializedWeightsConfig): WeightsConfig {
  return {
    defaultTagWeight: either(s.defaultTagWeight, 1),
    defaultCategoryWeight: either(s.defaultCategoryWeight, 1),
    tagWeights: MapUtil.fromObject(s.tagWeights || {}),
    categoryWeights: MapUtil.fromObject(s.categoryWeights || {}),
  };
}

const serializedWeightsConfigParser: Parser<SerializedWeightsConfig> = C.object(
  {
    defaultCategoryWeight: C.number,
    defaultTagWeight: C.number,
    categoryWeight: C.dict(C.number, C.fmap(C.string, parseCategoryId)),
    tagWeight: C.dict(C.number, C.string),
  }
);

export const weightsConfigParser: Parser<WeightsConfig> = C.fmap(
  serializedWeightsConfigParser,
  upgrade
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
