// @flow

import type {Database} from "better-sqlite3";
import stringify from "json-stable-stringify";
import dedent from "../../util/dedent";
import type {
  TopicId,
  PostId,
  Topic,
  Post,
  LikeAction,
  User,
  Tag,
} from "./fetch";
import {type TimestampMs} from "../../util/timestamp";
import * as MapUtil from "../../util/map";

// The version should be bumped any time the database schema is changed,
// so that the cache will be properly invalidated.
const VERSION = "discourse_mirror_v6";
const DEFINITION_CHECK_KEY = "definition_check";

/**
 * An interface for reading the local Discourse data.
 */
export interface ReadRepository {
  /**
   * Retrieve every Topic available.
   *
   * The order is unspecified.
   */
  topics(): $ReadOnlyArray<Topic>;

  /**
   * Retrieve every Post available.
   *
   * The order is unspecified.
   */
  posts(): $ReadOnlyArray<Post>;

  /**
   * Given a TopicId and a post number, find that numbered post within the topic.
   *
   * Returns undefined if no such post is available.
   */
  findPostInTopic(topicId: TopicId, indexWithinTopic: number): ?PostId;

  /**
   * Get usernames for all users.
   *
   * The order is unspecified.
   */
  users(): $ReadOnlyArray<User>;

  /**
   * Gets all of the like actions in the history.
   */
  likes(): $ReadOnlyArray<LikeAction>;

  /**
   * Gets the user with a given name, if they exist.
   *
   * Note: input username is case-insensitive.
   */
  findUser(username: string): ?User;

  /**
   * Gets a Topic by ID.
   */
  topicById(id: TopicId): ?Topic;

  /**
   * Gets a Post by ID.
   */
  postById(id: PostId): ?Post;
}

export type SyncHeads = {|
  /**
   * The timestamp of the last time we've loaded category definition topics.
   * Used for determining whether we should reload them during an update.
   */
  +definitionCheckMs: number,

  /**
   * The most recent bumpedMs timestamp of all topics.
   * Used for determining what the most recent topic changes we have stored in
   * our local mirror, and which we should fetch from the API during update.
   */
  +topicBumpMs: number,
|};

export type AddResult = {|
  +changes: number,
  +lastInsertRowid: number,
|};

// Read-write interface the mirror uses internally.
export interface MirrorRepository extends ReadRepository {
  addLike(like: LikeAction): AddResult;

  addOrReplaceUser(user: User): AddResult;

  addUserIfNotExists(user: User): AddResult;

  /**
   * For the given topic ID, retrieves the bumpedMs value.
   * Returns null, when the topic wasn't found.
   */
  bumpedMsForTopic(id: TopicId): number | null;

  /**
   * Finds the SyncHeads values, used as input to skip
   * already up-to-date content when mirroring.
   */
  syncHeads(): SyncHeads;

  /**
   * Idempotent insert/replace of a Topic, including all it's Posts.
   *
   * Note: this will insert new posts, update existing posts and delete old posts.
   * As these are separate queries, we use a transaction here.
   */
  replaceTopicTransaction(topic: Topic, posts: $ReadOnlyArray<Post>): void;

  /**
   * Bumps the definitionCheckMs (from SyncHeads) to the provided timestamp.
   */
  bumpDefinitionTopicCheck(timestampMs: TimestampMs): void;
}

function toAddResult({
  changes,
  lastInsertRowid,
}: {
  changes: number,
  lastInsertRowid: number,
}): AddResult {
  return {changes, lastInsertRowid};
}

export class SqliteMirrorRepository
  implements ReadRepository, MirrorRepository {
  +_db: Database;

  constructor(db: Database, serverUrl: string) {
    if (db == null) throw new Error("db: " + String(db));
    this._db = db;
    this._transaction(() => {
      this._initialize(serverUrl);
    });
  }

  _transaction(queries: () => void) {
    const db = this._db;
    if (db.inTransaction) {
      throw new Error("already in transaction");
    }
    try {
      db.prepare("BEGIN").run();
      queries();
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
        CREATE TABLE sync_heads (
          key TEXT PRIMARY KEY,
          timestamp_ms INTEGER NOT NULL
        )`,
      dedent`\
        CREATE TABLE users (
          username TEXT PRIMARY KEY,
          trust_level INTEGER
        )`,
      dedent`\
        CREATE TABLE topics (
            id INTEGER PRIMARY KEY,
            category_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            bumped_ms INTEGER NOT NULL,
            author_username TEXT NOT NULL,
            FOREIGN KEY(author_username) REFERENCES users(username)
        )
      `,
      // TODO: If this bloats, consider making a separate tags table, and
      // referencing topic_tags by integer id rather than full tag name.
      dedent`\
        CREATE TABLE topic_tags (
            topic_id INTEGER NOT NULL,
            tag_name TEXT NOT NULL,
            PRIMARY KEY(topic_id, tag_name),
            FOREIGN KEY(topic_id) REFERENCES topics(id)
      )
      `,
      dedent`\
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            timestamp_ms INTEGER NOT NULL,
            author_username TEXT NOT NULL,
            topic_id INTEGER NOT NULL,
            trust_level INTEGER NOT NULL,
            index_within_topic INTEGER NOT NULL,
            reply_to_post_index INTEGER,
            cooked TEXT NOT NULL,
            FOREIGN KEY(topic_id) REFERENCES topics(id),
            FOREIGN KEY(author_username) REFERENCES users(username)
        )
      `,
      dedent`\
        CREATE TABLE likes (
          username TEXT NOT NULL,
          post_id INTEGER NOT NULL,
          timestamp_ms INTEGER NOT NULL,
          CONSTRAINT username_post PRIMARY KEY (username, post_id),
          FOREIGN KEY(post_id) REFERENCES posts(id),
          FOREIGN KEY(username) REFERENCES users(username)
        )`,
    ];
    for (const sql of tables) {
      db.prepare(sql).run();
    }
  }

  syncHeads(): SyncHeads {
    const res = this._db
      .prepare(
        dedent`\
          SELECT
              (SELECT IFNULL(MAX(bumped_ms), 0) FROM topics) AS max_topic_bump,
              (SELECT timestamp_ms FROM sync_heads WHERE key = :DEFINITION_CHECK_KEY) AS definition_check
          `
      )
      .get({DEFINITION_CHECK_KEY});
    return {
      definitionCheckMs: res.definition_check || 0,
      topicBumpMs: res.max_topic_bump,
    };
  }

  topics(): $ReadOnlyArray<Topic> {
    return this._db.transaction(() => {
      const topics = this._db
        .prepare(
          dedent`\
            SELECT
              id,
              category_id,
              title,
              timestamp_ms,
              bumped_ms,
              author_username
            FROM topics
        `
        )
        .all()
        .map((x) => ({
          id: x.id,
          categoryId: x.category_id,
          title: x.title,
          timestampMs: x.timestamp_ms,
          bumpedMs: x.bumped_ms,
          authorUsername: x.author_username,
        }));

      const tags = this._db
        .prepare(
          dedent`\
            SELECT
              tag_name AS tagName,
              topic_id AS topicId
            FROM topic_tags
            ORDER BY tagName
        `
        )
        .all();
      const idToTags: Map<TopicId, Tag[]> = new Map();
      for (const {tagName, topicId} of tags) {
        MapUtil.pushValue(idToTags, topicId, tagName);
      }
      return topics.map((t) => {
        const tags = idToTags.get(t.id) || [];
        return {...t, tags};
      });
    })();
  }

  topicById(id: TopicId): ?Topic {
    const res = this._db
      .prepare(
        dedent`\
          SELECT
            id,
            category_id,
            title,
            timestamp_ms,
            bumped_ms,
            author_username,
            topic_tags.tag_name AS tagName
          FROM topics
          LEFT OUTER JOIN topic_tags
            ON topics.id = topic_tags.topic_id
          WHERE id = :id
          ORDER BY tagName
        `
      )
      .all({id});

    if (res.length === 0) {
      return null;
    }
    const first = res[0];
    const tags = first.tagName == null ? [] : res.map((x) => x.tagName);

    return {
      id: first.id,
      categoryId: first.category_id,
      tags,
      title: first.title,
      timestampMs: first.timestamp_ms,
      bumpedMs: first.bumped_ms,
      authorUsername: first.author_username,
    };
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
            trust_level,
            index_within_topic,
            reply_to_post_index,
            cooked
          FROM posts`
      )
      .all()
      .map((x) => ({
        id: x.id,
        timestampMs: x.timestamp_ms,
        authorUsername: x.author_username,
        topicId: x.topic_id,
        trustLevel: x.trust_level,
        indexWithinTopic: x.index_within_topic,
        replyToPostIndex: x.reply_to_post_index,
        cooked: x.cooked,
      }));
  }

  postById(id: PostId): ?Post {
    const res = this._db
      .prepare(
        dedent`\
          SELECT
            id,
            timestamp_ms,
            author_username,
            topic_id,
            trust_level,
            index_within_topic,
            reply_to_post_index,
            cooked
          FROM posts
          WHERE id = :id`
      )
      .get({id});

    if (!res) {
      return null;
    }

    return {
      id: res.id,
      timestampMs: res.timestamp_ms,
      authorUsername: res.author_username,
      topicId: res.topic_id,
      trustLevel: res.trust_level,
      indexWithinTopic: res.index_within_topic,
      replyToPostIndex: res.reply_to_post_index,
      cooked: res.cooked,
    };
  }

  users(): $ReadOnlyArray<User> {
    return this._db
      .prepare("SELECT username, trust_level FROM users")
      .all()
      .map((x) => ({
        username: x.username,
        trustLevel: x.trust_level,
      }));
  }

  findUser(username: string): ?User {
    const user = this._db
      .prepare(
        dedent`\
          SELECT username, trust_level
          FROM users
          WHERE username = :username COLLATE NOCASE
        `
      )
      .get({username});
    if (user == null) {
      return null;
    }
    return {username: user.username, trustLevel: user.trust_level};
  }

  likes(): $ReadOnlyArray<LikeAction> {
    return this._db
      .prepare("SELECT post_id, username, timestamp_ms FROM likes")
      .all()
      .map((x) => ({
        postId: x.post_id,
        timestampMs: x.timestamp_ms,
        username: x.username,
      }));
  }

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

  bumpDefinitionTopicCheck(timestampMs: TimestampMs): void {
    this._db
      .prepare(
        dedent`\
          REPLACE INTO sync_heads (
              key,
              timestamp_ms
          ) VALUES (
              :key,
              :timestamp_ms
          )
        `
      )
      .run({
        key: DEFINITION_CHECK_KEY,
        timestamp_ms: timestampMs,
      });
  }

  addLike(like: LikeAction): AddResult {
    this.addUserIfNotExists({username: like.username, trustLevel: null});
    const res = this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO likes (
              post_id,
              timestamp_ms,
              username
          ) VALUES (
              :post_id,
              :timestamp_ms,
              :username
          )
        `
      )
      .run({
        post_id: like.postId,
        timestamp_ms: like.timestampMs,
        username: like.username,
      });
    return toAddResult(res);
  }

  replaceTopicTransaction(topic: Topic, posts: $ReadOnlyArray<Post>) {
    this._transaction(() => {
      this.addTopic(topic);
      for (const post of posts) {
        this.addPost(post);
      }
      this.deleteUnexpectedPosts(
        topic.id,
        posts.map((p) => p.id)
      );
    });
  }

  deleteUnexpectedPosts(topicId: TopicId, expected: PostId[]): number {
    const res = this._db
      .prepare(
        dedent`\
          DELETE FROM posts
          WHERE topic_id = ?
          AND id NOT IN (${expected.map((_) => "?").join(",")})
        `
      )
      .run(topicId, ...expected);
    return res.changes;
  }

  bumpedMsForTopic(id: TopicId): number | null {
    const res = this._db
      .prepare(`SELECT bumped_ms FROM topics WHERE id = :id`)
      .get({id});
    return res != null ? res.bumped_ms : null;
  }

  addPost(post: Post): AddResult {
    this.addOrReplaceUser({
      username: post.authorUsername,
      trustLevel: post.trustLevel,
    });
    const res = this._db
      .prepare(
        dedent`\
          REPLACE INTO posts (
              id,
              timestamp_ms,
              author_username,
              topic_id,
              trust_level,
              index_within_topic,
              reply_to_post_index,
              cooked
          ) VALUES (
              :id,
              :timestamp_ms,
              :author_username,
              :topic_id,
              :trust_level,
              :index_within_topic,
              :reply_to_post_index,
              :cooked
          )
        `
      )
      .run({
        id: post.id,
        timestamp_ms: post.timestampMs,
        reply_to_post_index: post.replyToPostIndex,
        index_within_topic: post.indexWithinTopic,
        topic_id: post.topicId,
        trust_level: post.trustLevel,
        author_username: post.authorUsername,
        cooked: post.cooked,
      });
    return toAddResult(res);
  }

  addTopic(topic: Topic) {
    this._db.transaction(() => {
      this.addUserIfNotExists({
        username: topic.authorUsername,
        trustLevel: null,
      });
      this._db
        .prepare(
          dedent`\
            REPLACE INTO topics (
                id,
                category_id,
                title,
                timestamp_ms,
                bumped_ms,
                author_username
            ) VALUES (
                :id,
                :category_id,
                :title,
                :timestamp_ms,
                :bumped_ms,
                :author_username
            )
        `
        )
        .run({
          id: topic.id,
          category_id: topic.categoryId,
          title: topic.title,
          timestamp_ms: topic.timestampMs,
          bumped_ms: topic.bumpedMs,
          author_username: topic.authorUsername,
        });

      this._db
        .prepare(
          dedent`
            DELETE FROM topic_tags
            WHERE topic_id = :id
      `
        )
        .run({id: topic.id});

      const addTag = this._db.prepare(
        dedent`
          INSERT INTO topic_tags (
            tag_name,
            topic_id
          ) VALUES (
            :tagName,
            :id
          )
      `
      );
      for (const tagName of topic.tags) {
        addTag.run({id: topic.id, tagName});
      }
    })();
  }

  addUserIfNotExists(user: User): AddResult {
    const {trustLevel, username} = user;
    const res = this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO users (
            username,
            trust_level
          ) VALUES (
            :username,
            :trust_level
          )`
      )
      .run({username, trust_level: trustLevel});
    return toAddResult(res);
  }

  addOrReplaceUser(user: User): AddResult {
    const {trustLevel, username} = user;
    const res = this._db
      .prepare(
        dedent`\
          INSERT OR REPLACE INTO users (
            username,
            trust_level
          ) VALUES (
            :username,
            :trust_level
          )`
      )
      .run({username, trust_level: trustLevel});
    return toAddResult(res);
  }
}
