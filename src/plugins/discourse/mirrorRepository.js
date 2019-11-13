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
const VERSION = "discourse_mirror_v5";

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
}

export type MaxIds = {|
  +maxPostId: number,
  +maxTopicId: number,
|};

export type AddResult = {|
  +changes: number,
  +lastInsertRowid: number,
|};

// Read-write interface the mirror uses internally.
export interface MirrorRepository extends ReadRepository {
  maxIds(): MaxIds;
  addTopic(topic: Topic): AddResult;
  addPost(post: Post): AddResult;
  addLike(like: LikeAction): AddResult;

  /**
   * For the given topic ID, retrieves the bumpedMs value.
   * Returns null, when the topic wasn't found.
   */
  bumpedMsForTopic(id: TopicId): number | null;

  /**
   * Finds the TopicIds of topics that have one of the categoryIds as it's category.
   */
  topicsInCategories(
    categoryIds: $ReadOnlyArray<CategoryId>
  ): $ReadOnlyArray<TopicId>;
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

  maxIds(): MaxIds {
    const res = this._db
      .prepare(
        dedent`\
          SELECT
              (SELECT IFNULL(MAX(id), 0) FROM posts) AS max_post,
              (SELECT IFNULL(MAX(id), 0) FROM topics) AS max_topic
          `
      )
      .get();
    return {
      maxPostId: res.max_post,
      maxTopicId: res.max_topic,
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

  users(): $ReadOnlyArray<string> {
    return this._db
      .prepare("SELECT username FROM users")
      .pluck()
      .all();
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
