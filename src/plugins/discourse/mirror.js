// @flow

import * as Combo from "../../util/combo";
import type {TaskReporter} from "../../util/taskReporter";
import type {Discourse, Topic, TopicLatest} from "./fetch";
import {MirrorRepository} from "./mirrorRepository";

export type MirrorOptions = {|
  // Category definition topics don't show up in the list of bumped topics.
  // We need to proactively check them. This sets the interval at which we
  // should check.
  +recheckCategoryDefinitionsAfterMs: number,
|};

const optionsParserFields = {
  recheckCategoryDefinitionsAfterMs: Combo.number,
};
export const optionsParser: Combo.Parser<MirrorOptions> = Combo.object(
  optionsParserFields
);
export const optionsShapeParser: Combo.Parser<
  $Shape<MirrorOptions>
> = Combo.shape(optionsParserFields);

const defaultOptions: MirrorOptions = {
  recheckCategoryDefinitionsAfterMs: 24 * 3600 * 1000, // 24h
};

function sortTopicByBumpedMs(a: TopicLatest, b: TopicLatest): number {
  return a.bumpedMs - b.bumpedMs;
}

/**
 * Mirrors data from the Discourse API into a local sqlite db.
 *
 * This class allows us to persist a local copy of data from a Discourse
 * instance. We have it for reasons similar to why we have a GraphQL mirror for
 * GitHub; it allows us to avoid re-doing expensive IO every time we re-load
 * SourceCred. It also gives us robustness in the face of network failures (we
 * can keep however much we downloaded until the fault).
 *
 * As implemented, the Mirror will never update already-downloaded content,
 * meaning it will not catch edits or deletions. As such, it's advisable to
 * replace the cache periodically (perhaps once a week or month). We may
 * implement automatic cache invalidation in the future.
 *
 * Each Mirror instance is tied to a particular server. Trying to use a mirror
 * for multiple Discourse servers is not permitted; use separate Mirrors.
 */
export class Mirror {
  +_options: MirrorOptions;
  +_repo: MirrorRepository;
  +_fetcher: Discourse;
  +_serverUrl: string;

  /**
   * Construct a new Mirror instance.
   *
   * Takes a Database, which may be a pre-existing Mirror database. The
   * provided DiscourseInterface will be used to retrieve new data from Discourse.
   *
   * A serverUrl is required so that we can ensure that this Mirror is only storing
   * data from a particular Discourse server.
   */
  constructor(
    repo: MirrorRepository,
    fetcher: Discourse,
    serverUrl: string,
    options?: $Shape<MirrorOptions> = {}
  ) {
    this._repo = repo;
    this._fetcher = fetcher;
    this._serverUrl = serverUrl;
    this._options = {
      ...defaultOptions,
      ...options,
    };
  }

  async update(reporter: TaskReporter) {
    reporter.start("discourse");
    await this._updateTopicsV2(reporter);
    await this._updateLikes(reporter);
    reporter.finish("discourse");
  }

  async _updateTopicsV2(reporter: TaskReporter) {
    reporter.start("discourse/topics");

    const {
      topicBumpMs: lastLocalTopicBumpMs,
      definitionCheckMs: lastDefinitionCheckMs,
    } = this._repo.syncHeads();

    const startTime = Date.now();
    const shouldCheckDefinitions =
      startTime - lastDefinitionCheckMs >=
      this._options.recheckCategoryDefinitionsAfterMs;

    const bumpedTopics: TopicLatest[] = await this._fetcher.topicsBumpedSince(
      lastLocalTopicBumpMs
    );
    const topicBumpsById: Map<number, number> = new Map(
      bumpedTopics.map((t) => [t.id, t.bumpedMs])
    );

    // Make sure we have oldest first in our load queue.
    bumpedTopics.sort(sortTopicByBumpedMs);

    // Create a uniqueness filter.
    const existingTopics = new Set();
    const once = (tid) => {
      if (existingTopics.has(tid)) return false;
      existingTopics.add(tid);
      return true;
    };

    // Add definition topics if the flag to do so is set.
    const definitionTopicIds = shouldCheckDefinitions
      ? await this._fetcher.categoryDefinitionTopicIds()
      : [];

    // Note: order is important here.
    // Initial load should happen in order of bump date,
    // reloads at the end are ok to be in random order.
    const topicLoadQueue = [
      ...bumpedTopics.map((t) => t.id),
      ...definitionTopicIds,
    ].filter(once);

    for (const topicId of topicLoadQueue) {
      const topicWithPosts = await this._fetcher.topicWithPosts(topicId);
      if (topicWithPosts != null) {
        const {topic, posts} = topicWithPosts;

        // We find the bump by:
        // 1. What fetcher's topicsBumpedSince tells us.
        // 2. What the local DB contains (probably force updated a topic that wasn't bumped).
        // 3. Fall back on creation date (category definition topics don't normally have bump dates at all).
        const bumpedMs =
          topicBumpsById.get(topicId) ||
          this._repo.bumpedMsForTopic(topicId) ||
          topic.timestampMs;
        if (bumpedMs == null) {
          throw new Error(`Missing bump date for topic ID: ${topic.id}`);
        }
        const mergedTopic: Topic = {
          ...topic,
          bumpedMs,
        };
        this._repo.replaceTopicTransaction(mergedTopic, posts);
      }
    }

    if (shouldCheckDefinitions) {
      // Note: use the start time as to avoid missing any changes
      // between when we queries upstream and when we completed all tasks.
      this._repo.bumpDefinitionTopicCheck(startTime);
    }

    reporter.finish("discourse/topics");
  }

  async _updateLikes(reporter: TaskReporter) {
    const addLike = (like) => {
      try {
        const res = this._repo.addLike(like);
        return {doneWithUser: res.changes === 0};
      } catch (e) {
        console.warn(
          `Warning: Encountered error '${e.message}' ` +
            `on a like by ${like.username} ` +
            `on post id ${like.postId}.`
        );
        return {doneWithUser: false};
      }
    };

    // I don't want to hard code the expected page size, in case it changes upstream.
    // However, it's helpful to have a good guess of what the page size is, because if we
    // get a result which is shorter than the page size, we know we've hit the end of the
    // user's history, so we don't need to query any more.
    // So, we guess that the largest page size we've seen thus far is likely the page size,
    // and if we see any shorter pages, we know we are done for that particular user.
    // If we are wrong about the page size, the worst case is that we do an unnecessary
    // query when we are actually already done with the user.
    let possiblePageSize = 0;
    // TODO(perf): In the best case (there are no new likes), this requires
    // doing one query for every user who ever commented in the instance. This
    // is a bit excessive. For each user, we could store when we last checked
    // their likes, and when they last posted. Then we could only scan users
    // who we either haven't scanned in the last week, or who have been active
    // since our last scan. This would likely improve the performance of this
    // section of the update significantly.

    reporter.start("discourse/likes");
    for (const {username} of this._repo.users()) {
      let offset = 0;
      let upToDate = false;
      while (!upToDate) {
        const likeActions = await this._fetcher.likesByUser(username, offset);
        if (likeActions == null) {
          break;
        }
        possiblePageSize = Math.max(likeActions.length, possiblePageSize);
        for (const like of likeActions) {
          if (addLike(like).doneWithUser) {
            upToDate = true;
            break;
          }
        }
        if (likeActions.length === 0 || likeActions.length < possiblePageSize) {
          upToDate = true;
        }
        offset += likeActions.length;
      }
    }
    reporter.finish("discourse/likes");
  }
}
