// @flow

import type {CategoryId, TopicId} from "../discourse/fetch";

export type InitiativeOptions = {|
  /**
   * The Discourse category from which to parse Topics as Initiatives.
   */
  +discourseCategoryId: CategoryId,

  /**
   * Topics that should be skipped for Initiative parsing if encountered.
   *
   * Useful mainly for ignoring Topics in the initiatives category that
   * we know are not intended as an Initiative. Such as the "about" topic,
   * or perhaps a discussion / announcement topics surrounding initiatives.
   */
  +topicBlacklist: $ReadOnlyArray<TopicId>,
|};
