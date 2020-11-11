// @flow

import type Database from "better-sqlite3";
import stringify from "json-stable-stringify";
import * as Model from "./models";
import dedent from "../../util/dedent";

// The version should be bumped any time the database schema is changed,
const VERSION = "slack_mirror_v0";

/**
 * An interface for reading the local Slack data
 */
export class SqliteMirrorRepository {
  +_db: Database;

  constructor(db: Database, token: Model.SlackToken) {
    if (db == null) throw new Error("db: " + String(db));
    this._db = db;
    this._transaction(() => {
      this._initialize(token);
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

  _initialize(token: Model.SlackToken) {
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

    /**
     * All rows within sqlite tables have a 64 bit signed integer key
     * that uniquely identifies the row within the table (`rowid`)
     * https://www.sqlite.org/lang_createtable.html#rowid
     */

    const tables = [
      dedent`\
        CREATE TABLE channels (
          channel_id TEXT PRIMARY KEY,
          name TEXT NOT NULL
        )
      `,
      dedent`\
        CREATE TABLE members (
          user_id TEXT PRIMARY KEY,
          name TEXT,
          email TEXT NOT NULL
        )
      `,
      dedent`\
        CREATE TABLE messages (
          channel_id TEXT NOT NULL,
          timestamp_ms TEXT NOT NULL,
          author_id TEXT NOT NULL,
          message_body TEXT,
          thread INT,
          in_reply_to TEXT
        )
      `,
      dedent`\
        CREATE TABLE message_reactions (
          channel_id TEXT NOT NULL,
          message_ts TEXT NOT NULL,
          reaction_name TEXT,
          reactor TEXT
        )
      `,
      dedent`\
        CREATE TABLE message_mentions (
          message_id TEXT NOT NULL,
          mentioned_user_id TEXT NOT NULL
        )
      `,
    ];

    for (const table of tables) {
      db.prepare(table).run();
    }
  }

  addChannel(channel: Model.Conversation) {
    this._db
      .prepare(
        dedent`\
            INSERT OR IGNORE INTO channels (
              channel_id, name
            ) VALUES (
              :channel_id, :name
            )
          `
      )
      .run({
        channel_id: channel.id,
        name: channel.name,
      });
  }

  addMember(member: Model.User) {
    this._db
      .prepare(
        dedent`\
            INSERT or IGNORE INTO members (
              user_id, name, email
            ) VALUES (
              :user_id, :name, :email
            )
          `
      )
      .run({
        user_id: member.id,
        name: member.name,
        email: member.email,
      });
  }

  addMessage(message: Model.Message) {
    // explicit cast to integer is required since no boolean bindings exist in sqlite
    let is_thread;
    if (message.thread) is_thread = 1;
    else is_thread = 0;
    this._db
      .prepare(
        dedent`\
          INSERT INTO messages (
            channel_id, timestamp_ms, author_id, message_body, thread, in_reply_to
          ) VALUES (
            :channel_id, :timestamp_ms, :author_id, :message_body, :thread, :in_reply_to
          )
        `
      )
      .run({
        channel_id: message.channel,
        timestamp_ms: message.id,
        author_id: message.authorId,
        message_body: message.text,
        thread: is_thread,
        in_reply_to: message.in_reply_to,
      });
    for (const reaction of message.reactions) {
      for (const user of reaction.users) {
        this._db
          .prepare(
            dedent`\
            INSERT INTO message_reactions (
              channel_id, message_ts, reaction_name, reactor
            ) VALUES (
              :channel_id, :message_ts, :reaction_name, :reactor
            )
          `
          )
          .run({
            channel_id: message.channel,
            message_ts: message.id,
            reaction_name: reaction.name,
            reactor: user,
          });
      }
    }
    for (const mentioned_user of message.mentions) {
      this._db
        .prepare(
          dedent`\
            INSERT INTO message_mentions (
              message_id, mentioned_user_id
            ) VALUES (
              :message_id, :mentioned_user_id
            )
          `
        )
        .run({
          message_id: message.id,
          mentioned_user_id: mentioned_user,
        });
    }
  }
}
