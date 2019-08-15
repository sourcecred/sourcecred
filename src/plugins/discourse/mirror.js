// @flow

import type Database from "better-sqlite3";
import stringify from "json-stable-stringify";
import dedent from "../../util/dedent";
import {
  type Discourse,
  type TopicId,
  type PostId,
  type Topic,
  type Post,
} from "./fetch";

// The version should be bumped any time the database schema is changed,
// so that the cache will be properly invalidated.
const VERSION = "discourse_mirror_v1";

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
  +_db: Database;
  +_fetcher: Discourse;

  /**
   * Construct a new Mirror instance.
   *
   * Takes a Database, which may be a pre-existing Mirror database. The
   * provided DiscourseInterface will be used to retrieve new data from Discourse.
   *
   * A serverUrl is required so that we can ensure that this Mirror is only storing
   * data from a particular Discourse server.
   */
  constructor(db: Database, fetcher: Discourse, serverUrl: string) {
    if (db == null) throw new Error("db: " + String(db));
    this._db = db;
    this._fetcher = fetcher;
    if (db.inTransaction) {
      throw new Error("already in transaction");
    }
    try {
      db.prepare("BEGIN").run();
      this._initialize(serverUrl);
      if (db.inTransaction) {
        db.prepare("COMMIT").run();
      }
    } finally {
      if (db.inTransaction) {
        db.prepare("ROLLBACK").run();
      }
    }
  }

  _initialize(serverUrl: string) {
    const db = this._db;
    // We store the config in a singleton table `meta`, whose unique row
    // has primary key `0`. Only the first ever insert will succeed; we
    // are locked into the first config.
    db.prepare(
      dedent`\
        CREATE TABLE IF NOT EXISTS meta (
            zero INTEGER PRIMARY KEY,
            config TEXT NOT NULL
        )
      `
    ).run();

    const config = stringify({
      version: VERSION,
      serverUrl: serverUrl,
    });

    const existingConfig: string | void = db
      .prepare("SELECT config FROM meta")
      .pluck()
      .get();
    if (existingConfig === config) {
      // Already set up; nothing to do.
      return;
    } else if (existingConfig !== undefined) {
      throw new Error(
        "Database already populated with incompatible server or version"
      );
    }
    db.prepare("INSERT INTO meta (zero, config) VALUES (0, ?)").run(config);

    const tables = [
      dedent`\
        CREATE TABLE topics (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            author_username TEXT NOT NULL
        )
      `,
      dedent`\
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            timestamp_ms INTEGER NOT NULL,
            author_username TEXT NOT NULL,
            topic_id INTEGER NOT NULL,
            index_within_topic INTEGER NOT NULL,
            reply_to_post_index INTEGER,
            FOREIGN KEY(topic_id) REFERENCES topics(id)
        )
      `,
    ];
    for (const sql of tables) {
      db.prepare(sql).run();
    }
  }

  topics(): $ReadOnlyArray<Topic> {
    return this._db
      .prepare(
        dedent`\
        SELECT
          id,
          timestamp_ms,
          author_username,
          title
        FROM topics`
      )
      .all()
      .map((x) => ({
        id: x.id,
        timestampMs: x.timestamp_ms,
        authorUsername: x.author_username,
        title: x.title,
      }));
  }

  posts(): $ReadOnlyArray<Post> {
    return this._db
      .prepare(
        dedent`\
        SELECT
          id,
          timestamp_ms,
          author_username,
          topic_id,
          index_within_topic,
          reply_to_post_index
        FROM posts`
      )
      .all()
      .map((x) => ({
        id: x.id,
        timestampMs: x.timestamp_ms,
        authorUsername: x.author_username,
        topicId: x.topic_id,
        indexWithinTopic: x.index_within_topic,
        replyToPostIndex: x.reply_to_post_index,
      }));
  }

  /**
   * Given a TopicId and a post number, find that numbered post within the topic.
   *
   * Returns undefined if no such post exists.
   */
  findPostInTopic(topicId: TopicId, indexWithinTopic: number): ?PostId {
    return this._db
      .prepare(
        dedent`\
          SELECT id
          FROM posts
          WHERE topic_id = :topic_id AND index_within_topic = :index_within_topic
        `
      )
      .pluck()
      .get({topic_id: topicId, index_within_topic: indexWithinTopic});
  }

  async update() {
    const db = this._db;
    const latestTopicId = await this._fetcher.latestTopicId();
    const lastLocalPostId =
      db
        .prepare("SELECT MAX(id) FROM posts")
        .pluck()
        .get() || 0;

    const lastLocalTopicId =
      db
        .prepare("SELECT MAX(id) FROM topics")
        .pluck()
        .get() || 0;

    const encounteredPostIds = new Set();

    function addPost(post: Post) {
      const {
        id,
        timestampMs,
        replyToPostIndex,
        indexWithinTopic,
        topicId,
        authorUsername,
      } = post;
      db.prepare(
        dedent`\
          REPLACE INTO posts (
            id,
            timestamp_ms,
            author_username,
            topic_id,
            index_within_topic,
            reply_to_post_index
          ) VALUES (
            :id,
            :timestamp_ms,
            :author_username,
            :topic_id,
            :index_within_topic,
            :reply_to_post_index
          )
        `
      ).run({
        id,
        timestamp_ms: timestampMs,
        reply_to_post_index: replyToPostIndex,
        index_within_topic: indexWithinTopic,
        topic_id: topicId,
        author_username: authorUsername,
      });
      encounteredPostIds.add(id);
    }

    for (
      let topicId = lastLocalTopicId + 1;
      topicId <= latestTopicId;
      topicId++
    ) {
      const topicWithPosts = await this._fetcher.topicWithPosts(topicId);
      if (topicWithPosts != null) {
        const {topic, posts} = topicWithPosts;
        const {id, title, timestampMs, authorUsername} = topic;
        this._db
          .prepare(
            dedent`\
            REPLACE INTO topics (
              id,
              title,
              timestamp_ms,
              author_username
            ) VALUES (
              :id,
              :title,
              :timestamp_ms,
              :author_username
            )`
          )
          .run({
            id,
            title,
            timestamp_ms: timestampMs,
            author_username: authorUsername,
          });
        for (const post of posts) {
          addPost(post);
        }
      }
    }

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
  }
}
