// @flow

import type {Database} from "better-sqlite3";
import stringify from "json-stable-stringify";
import dedent from "../../util/dedent";
import type {
  CategoryId,
  TopicId,
  PostId,
  Topic,
  Post,
  LikeAction,
} from "./fetch";

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
  users(): $ReadOnlyArray<string>;

  /**
   * Gets all of the like actions in the history.
   */
  likes(): $ReadOnlyArray<LikeAction>;

  /**
   * Finds the TopicIds of topics that have one of the categoryIds as it's category.
   */
  topicsInCategories(
    categoryIds: $ReadOnlyArray<CategoryId>
  ): $ReadOnlyArray<TopicId>;

  /**
   * Gets the username of a user, if it exists.
   *
   * Note: input username is case-insensitive.
   */
  findUsername(username: string): ?string;

  /**
   * Gets a Topic by ID.
   */
  topicById(id: TopicId): ?Topic;

  /**
   * Gets a number of Posts in a given Topic. Starting with the first post,
   * ordered by `indexWithinTopic`.
   *
   * numberOfPosts: the maximum number of posts to get (may return fewer).
   */
  postsInTopic(topicId: TopicId, numberOfPosts: number): $ReadOnlyArray<Post>;
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
  bumpDefinitionTopicCheck(timestampMs: number): void;
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
      "CREATE TABLE users (username TEXT PRIMARY KEY)",
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
      dedent`\
        CREATE TABLE posts (
            id INTEGER PRIMARY KEY,
            timestamp_ms INTEGER NOT NULL,
            author_username TEXT NOT NULL,
            topic_id INTEGER NOT NULL,
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
    return this._db
      .prepare(
        dedent`\
        SELECT
          id,
          category_id,
          title,
          timestamp_ms,
          bumped_ms,
          author_username
        FROM topics`
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
          author_username
        FROM topics
        WHERE id = :id`
      )
      .get({id});

    if (!res) {
      return null;
    }

    return {
      id: res.id,
      categoryId: res.category_id,
      title: res.title,
      timestampMs: res.timestamp_ms,
      bumpedMs: res.bumped_ms,
      authorUsername: res.author_username,
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
        indexWithinTopic: x.index_within_topic,
        replyToPostIndex: x.reply_to_post_index,
        cooked: x.cooked,
      }));
  }

  postsInTopic(topicId: TopicId, numberOfPosts: number): $ReadOnlyArray<Post> {
    return this._db
      .prepare(
        dedent`\
        SELECT
          id,
          timestamp_ms,
          author_username,
          topic_id,
          index_within_topic,
          reply_to_post_index,
          cooked
        FROM posts
        WHERE topic_id = :topic_id
        ORDER BY index_within_topic ASC
        LIMIT :max`
      )
      .all({topic_id: topicId, max: numberOfPosts})
      .map((x) => ({
        id: x.id,
        timestampMs: x.timestamp_ms,
        authorUsername: x.author_username,
        topicId: x.topic_id,
        indexWithinTopic: x.index_within_topic,
        replyToPostIndex: x.reply_to_post_index,
        cooked: x.cooked,
      }));
  }

  users(): $ReadOnlyArray<string> {
    return this._db.prepare("SELECT username FROM users").pluck().all();
  }

  findUsername(username: string): ?string {
    return this._db
      .prepare(
        dedent`\
          SELECT username
          FROM users
          WHERE username = :username COLLATE NOCASE
        `
      )
      .pluck()
      .get({username});
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

  bumpDefinitionTopicCheck(timestampMs: number): void {
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
    this.addUser(like.username);
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

  topicsInCategories(
    categoryIds: $ReadOnlyArray<CategoryId>
  ): $ReadOnlyArray<TopicId> {
    return this._db
      .prepare(
        dedent`\
          SELECT id FROM topics
          WHERE category_id IN (${categoryIds.map((_) => "?").join(",")})
        `
      )
      .all(...categoryIds)
      .map((t) => t.id);
  }

  bumpedMsForTopic(id: TopicId): number | null {
    const res = this._db
      .prepare(`SELECT bumped_ms FROM topics WHERE id = :id`)
      .get({id});
    return res != null ? res.bumped_ms : null;
  }

  addPost(post: Post): AddResult {
    this.addUser(post.authorUsername);
    const res = this._db
      .prepare(
        dedent`\
          REPLACE INTO posts (
              id,
              timestamp_ms,
              author_username,
              topic_id,
              index_within_topic,
              reply_to_post_index,
              cooked
          ) VALUES (
              :id,
              :timestamp_ms,
              :author_username,
              :topic_id,
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
        author_username: post.authorUsername,
        cooked: post.cooked,
      });
    return toAddResult(res);
  }

  addTopic(topic: Topic): AddResult {
    this.addUser(topic.authorUsername);
    const res = this._db
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
    return toAddResult(res);
  }

  addUser(username: string): AddResult {
    const res = this._db
      .prepare("INSERT OR IGNORE INTO users (username) VALUES (?)")
      .run(username);
    return toAddResult(res);
  }
}
