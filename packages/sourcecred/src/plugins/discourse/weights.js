// @flow

import {type NodeWeight} from "../../core/weights";
import * as C from "../../util/combo";
import * as MapUtil from "../../util/map";
import {orElse as either} from "../../util/null";
import {DEFAULT_TRUST_LEVEL_TO_WEIGHT} from "./createGraph";
import {type User} from "./fetch";
import {type CategoryId as MirrorCategoryId, type Tag} from "./fetch";

// Expected to be an integer string, like "1" or "123"
export opaque type CategoryId: string = string;
// No restrictions (can be more specific later if we investigate Discourse)
export opaque type TagId: string = string;

export function parseCategoryId(id: string): CategoryId {
  const result = parseInt(id, 10);
  if (Number.isNaN(result) || result.toString() !== id) {
    throw new Error(`CategoryId should be a string integer; got ${id}`);
  }
  return id;
}

// parse out the opaque type
export function parseTagId(id: string): TagId {
  return id;
}

export type SerializedWeightsConfig = {|
  /**
   * Tags can be configured to confer specific like-weight multipliers when
   * added to a Topic.
   * If a tag does not have a configured weight, the defaultWeight is applied.
   * An example configuration might look like:
   * ```
   * "weights": {
   *   "defaultTagWeight": 1,
   *   "tagWeights": {
   *     "foo": 0,
   *     "bar": 1.25,
   *     "baz": 2
   *   }
   *   // categoryWeight configs...
   * }
   * ```
   * where foo and bar are the names of tags used in discourse.
   *
   * When multiple tags are assigned to a topic, their weights are multiplied
   * together to yield a total tag Weight multiplier. In our example configuration,
   * if both foo and bar are added to a topic, likes on posts in the topic will
   * have a weight of 0, (0 * 1.25 = 0), which means that no cred will be minted
   * by those likes.
   *
   * If "bar" and "baz" are both added to another topic, the likes on all posts
   * in that topic will carry a weight of 2.5 (1.25 * 2 = 2.5), which means that
   * 2.5x as much cred will be minted by those likes.
   */
  +defaultTagWeight?: NodeWeight,
  +tagWeights?: {|[TagId]: NodeWeight|},
  /**
   * Categories can be configured to confer a specific like-weight multiplier
   * when added to a Topic.
   * If a category does not have a configured weight, the defaultWeight is applied.
   * An example configuration might look like:
   * ```
   * weights: {
   *  "defaultCategoryWeight": 1,
   *  "categoryWeights": {
   *    "5": 0,
   *    "36": 1.25
   *  }
   *  // tagWeight configs...
   * }
   * ```
   * where "5" and "36" are the categoryIds in discourse.
   *
   * An easy way to find the categoryId for a given category is to browse to the
   * categories section in discourse
   * (e.g. https://discourse.sourcecred.io/categories).
   * Then mousing over or clicking on a category will bring you to a url that
   * has the shape https://exampleUrl.com/c/<category name>/<categoryId>
   * Clicking on the community category in sourcecred navigates to
   * https://discourse.sourcecred.io/c/community/26 for example, where the
   * categoryId is 26
   */
  +defaultCategoryWeight?: NodeWeight,
  +categoryWeights?: {|[CategoryId]: NodeWeight|},
  /*
   * Tags and Topic Category can be used in combination to create like-weight
   * multipliers on Topics. This means that if any assigned tag or topic category
   * is set to 0, all likes on that topic will mint zero cred.
   */
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

export const serializedWeightsConfigParser: C.Parser<SerializedWeightsConfig> =
  C.object(
    {},
    {
      defaultCategoryWeight: C.number,
      defaultTagWeight: C.number,
      categoryWeights: C.dict(
        C.number,
        C.fmap(C.delimited("//"), parseCategoryId)
      ),
      tagWeights: C.dict(C.number, C.fmap(C.string, parseTagId)),
    }
  );

export const weightsConfigParser: C.Parser<WeightsConfig> = C.fmap(
  serializedWeightsConfigParser,
  upgrade
);

export function likeWeight(
  weights: WeightsConfig,
  user: ?User,
  category: ?MirrorCategoryId,
  tags: ?$ReadOnlyArray<Tag>
): NodeWeight {
  const trustLevel = user == null ? 0 : _trustLevelWeight(user.trustLevel);
  const categoryWeight =
    category == null ? 1 : _categoryWeight(category, weights);
  const tagWeight = tags == null ? 1 : _weightFromTags(tags, weights);
  return trustLevel * categoryWeight * tagWeight;
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

export function _categoryWeight(
  category: MirrorCategoryId,
  {categoryWeights, defaultCategoryWeight}: WeightsConfig
): NodeWeight {
  const weight = categoryWeights.get(category);
  return weight == null ? defaultCategoryWeight : weight;
}

export function _weightFromTags(
  tags: $ReadOnlyArray<Tag>,
  {tagWeights, defaultTagWeight}: WeightsConfig
): NodeWeight {
  const weightForTag = (tagId: TagId) =>
    either(tagWeights.get(tagId), defaultTagWeight);
  return tags.reduce((acc, tag) => acc * weightForTag(tag), 1);
}
