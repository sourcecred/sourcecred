// @flow

import {type NodeWeight} from "../../core/weights";
import {DEFAULT_TRUST_LEVEL_TO_WEIGHT} from "./createGraph";
import {type User} from "./fetch";

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
