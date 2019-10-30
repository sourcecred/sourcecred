// @flow

import type {TaskReporter} from "../../util/taskReporter";
import {type Discourse} from "./fetch";
import {MirrorRepository} from "./mirrorRepository";

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
  constructor(repo: MirrorRepository, fetcher: Discourse, serverUrl: string) {
    this._repo = repo;
    this._fetcher = fetcher;
    this._serverUrl = serverUrl;
  }

  async update(reporter: TaskReporter) {
    // Local functions add the warning and tracking semantics we want from them.
    const encounteredPostIds = new Set();

    const addPost = (post) => {
      try {
        encounteredPostIds.add(post.id);
        return this._repo.addPost(post);
      } catch (e) {
        const url = `${this._serverUrl}/t/${post.topicId}/${post.indexWithinTopic}`;
        console.warn(
          `Warning: Encountered error '${e.message}' while adding post ${url}.`
        );
        return {changes: 0, lastInsertRowid: -1};
      }
    };

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

    reporter.start("discourse");

    const {
      maxPostId: lastLocalPostId,
      maxTopicId: lastLocalTopicId,
    } = this._repo.maxIds();

    reporter.start("discourse/topics");
    const latestTopicId = await this._fetcher.latestTopicId();
    for (
      let topicId = lastLocalTopicId + 1;
      topicId <= latestTopicId;
      topicId++
    ) {
      const topicWithPosts = await this._fetcher.topicWithPosts(topicId);
      if (topicWithPosts != null) {
        const {topic, posts} = topicWithPosts;
        this._repo.addTopic(topic);
        for (const post of posts) {
          addPost(post);
        }
      }
    }
    reporter.finish("discourse/topics");

    reporter.start("discourse/posts");
    const latestPosts = await this._fetcher.latestPosts();
    for (const post of latestPosts) {
      if (!encounteredPostIds.has(post.id) && post.id > lastLocalPostId) {
        addPost(post);
      }
    }

    const latestPost = latestPosts[0];
    const latestPostId = latestPost == null ? 0 : latestPost.id;
    for (let postId = lastLocalPostId + 1; postId <= latestPostId; postId++) {
      if (encounteredPostIds.has(postId)) {
        continue;
      }
      const post = await this._fetcher.post(postId);
      if (post != null) {
        addPost(post);
      }
    }
    reporter.finish("discourse/posts");

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
    const addUserLikes = async (user: string) => {
      let offset = 0;
      let upToDate = false;
      while (!upToDate) {
        const likeActions = await this._fetcher.likesByUser(user, offset);
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
    };
    for (const user of this._repo.users()) {
      try {
        await addUserLikes(user);
      } catch (e) {
        console.warn(
          `Warning: Encountered error '${e.message}' ` +
            `while processing likes for ${user}; skipping this user.`
        );
      }
    }
    reporter.finish("discourse/likes");
    reporter.finish("discourse");
  }
}
