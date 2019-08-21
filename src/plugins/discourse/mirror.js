// @flow

import type {Database} from "better-sqlite3";
import stringify from "json-stable-stringify";
import dedent from "../../util/dedent";
import type {TaskReporter} from "../../util/taskReporter";
import {
  type Discourse,
  type TopicId,
  type PostId,
  type Topic,
  type Post,
  type LikeAction,
} from "./fetch";

// The version should be bumped any time the database schema is changed,
// so that the cache will be properly invalidated.
const VERSION = "discourse_mirror_v3";

/**
 * An interface for retrieving all of the Discourse data at once.
 *
 * Also has some convenience methods for interpeting the data (e.g. getting
 * a post by its index in a topic).
 *
 * The mirror implements this; it's factored out as an interface for
 * ease of testing.
 */
export interface DiscourseData {
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
export class Mirror implements DiscourseData {
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
      "CREATE TABLE users (username TEXT PRIMARY KEY)",
      dedent`\
        CREATE TABLE topics (
            id INTEGER PRIMARY KEY,
            title TEXT NOT NULL,
            timestamp_ms INTEGER NOT NULL,
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

  async update(reporter: TaskReporter) {
    reporter.start("discourse");
    const db = this._db;
    const {max_post: lastLocalPostId, max_topic: lastLocalTopicId} = db
      .prepare(
        dedent`\
          SELECT
              (SELECT IFNULL(MAX(id), 0) FROM posts) AS max_post,
              (SELECT IFNULL(MAX(id), 0) FROM topics) AS max_topic
          `
      )
      .get();

    const encounteredPostIds = new Set();

    const addPost: (Post) => void = (() => {
      const query = db.prepare(
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
      );
      return function addPost(post: Post) {
        addUser(post.authorUsername);
        query.run({
          id: post.id,
          timestamp_ms: post.timestampMs,
          reply_to_post_index: post.replyToPostIndex,
          index_within_topic: post.indexWithinTopic,
          topic_id: post.topicId,
          author_username: post.authorUsername,
        });
        encounteredPostIds.add(post.id);
      };
    })();

    const addUser: (username: string) => void = (() => {
      const query = db.prepare(
        "INSERT OR IGNORE INTO users (username) VALUES (?)"
      );
      return function addUser(username: string) {
        query.run(username);
      };
    })();

    const addTopic: (Topic) => void = (() => {
      const query = this._db.prepare(
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
          )
        `
      );
      return function addTopic(topic: Topic) {
        addUser(topic.authorUsername);
        query.run({
          id: topic.id,
          title: topic.title,
          timestamp_ms: topic.timestampMs,
          author_username: topic.authorUsername,
        });
      };
    })();

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
        addTopic(topic);
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

    /**
     * Add a like action to the database. The user of the like is
     * assumed to already exist in the database; if this is not known to
     * be the case, run `addUser(like.username)` first.
     *
     * Returns a status indicating whether the database changed as a
     * result of this call.
     */
    const addLike: (like: LikeAction) => {|+changed: boolean|} = (() => {
      const query = db.prepare(
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
      );
      return function addLike(like: LikeAction) {
        const runResult = query.run({
          post_id: like.postId,
          timestamp_ms: like.timestampMs,
          username: like.username,
        });
        return {changed: runResult.changes > 0};
      };
    })();

    reporter.start("discourse/likes");
    for (const user of this.users()) {
      let offset = 0;
      let upToDate = false;
      while (!upToDate) {
        const likeActions = await this._fetcher.likesByUser(user, offset);
        possiblePageSize = Math.max(likeActions.length, possiblePageSize);
        for (const like of likeActions) {
          if (!addLike(like).changed) {
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
    reporter.finish("discourse");
  }
}
