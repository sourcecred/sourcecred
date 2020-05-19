// @flow

import type Database from "better-sqlite3";
import stringify from "json-stable-stringify";
import * as Model from "./models";
import dedent from "../../util/dedent";
import * as NullUtil from "../../util/null";

const VERSION = "DISCORD_MIRROR_v1";

/**
 * Persists a local copy of data from a Discord Guild.
 * Implements create and read functionality.
 *
 * Each Mirror instance is tied to a particular Guild. Trying to use a mirror
 * for multiple Discord Guilds is not permitted; use separate Mirrors.
 *
 * Note that Mirror persists separate Tables for Users and Guild Members.
 * Members are distinguished by membership in the Guild. Non-Member
 * Discord Users can participate in a Guild's activity by leaving comments,
 * reactions, etc. In our model, Members have a property, User, which
 * represents a full User object. Because of this, we save the User in the
 * AddMember method.
 */
export class SqliteMirror {
  +_db: Database;

  /**
   * Construct a new SqliteMirror instance.
   *
   * Takes a Database and GuildId.
   */
  constructor(db: Database, guildId: Model.Snowflake) {
    this._db = db;
    this._transaction(() => {
      this._initialize(guildId);
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

  _initialize(guild: Model.Snowflake) {
    const db = this._db;
    // We store the config in a singleton table `meta`, whose unique row
    // has PRIMARY KEY `0`. Only the first ever insert will succeed; we
    // are locked into the first config.
    db.prepare(
      dedent`\
        CREATE TABLE IF NOT EXISTS meta (
            zero INTEGER PRIMARY KEY NOT NULL,
            config TEXT NOT NULL
        )
      `
    ).run();

    const config = stringify({
      version: VERSION,
      guild,
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
        CREATE TABLE channels (
            id TEXT PRIMARY KEY NOT NULL,
            type TEXT NOT NULL,
            name TEXT NOT NULL
        )
      `,
      dedent`\
        CREATE TABLE users (
            id TEXT PRIMARY KEY NOT NULL,
            username TEXT NOT NULL,
            discriminator TEXT NOT NULL,
            bot INTEGER NOT NULL
        )
      `,
      dedent`\
        CREATE TABLE members (
            user_id TEXT PRIMARY KEY NOT NULL,
            nick TEXT,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )
      `,
      dedent`\
        CREATE TABLE messages (
            id TEXT PRIMARY KEY NOT NULL,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            non_user_author INTEGER NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            content TEXT NOT NULL,
            FOREIGN KEY(channel_id) REFERENCES channels(id)
        )
      `,
      dedent`
        CREATE INDEX messages__chanel_id
        ON messages (channel_id)
      `,
      dedent`\
        CREATE TABLE message_reactions (
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            emoji TEXT NOT NULL,
            FOREIGN KEY(channel_id) REFERENCES channels(id),
            FOREIGN KEY(message_id) REFERENCES messages(id),
            FOREIGN KEY(author_id) REFERENCES users(id),
            CONSTRAINT value_object PRIMARY KEY (channel_id, message_id, author_id, emoji)
        )
      `,
      dedent`\
        CREATE INDEX message_reactions__channel_id__message_id
        ON message_reactions (channel_id, message_id)
      `,
      dedent`\
        CREATE TABLE message_mentions (
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            FOREIGN KEY(channel_id) REFERENCES channels(id),
            FOREIGN KEY(message_id) REFERENCES messages(id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            CONSTRAINT value_object PRIMARY KEY (channel_id, message_id, user_id)
        )
      `,
      dedent`\
        CREATE INDEX message_mentions__channel_id__message_id
        ON message_mentions (channel_id, message_id)
      `,
    ];
    for (const sql of tables) {
      db.prepare(sql).run();
    }
  }

  users(): $ReadOnlyArray<Model.User> {
    return this._db
      .prepare(
        dedent`\
          SELECT
            id,
            username,
            discriminator,
            bot
          FROM users`
      )
      .all()
      .map((x) => ({
        id: x.id,
        username: x.username,
        discriminator: x.discriminator,
        bot: x.bot === 1,
      }));
  }

  user(id: Model.Snowflake): ?Model.User {
    const user = this._db
      .prepare(
        dedent`\
        SELECT
          id,
          username,
          discriminator,
          bot
        FROM users
        WHERE id = :id
       `
      )
      .get({id: id});

    if (!user) {
      return null;
    } else {
      return {
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        bot: user.bot === 1,
      };
    }
  }

  members(): $ReadOnlyArray<Model.GuildMember> {
    return this._db
      .prepare(
        dedent`\
          SELECT
            user_id,
            nick
          FROM members`
      )
      .all()
      .map((x) => ({
        user: NullUtil.get(
          this.user(x.user_id),
          `No user_id found for ${x.user_id}`
        ),
        nick: x.nick,
      }));
  }

  member(userId: Model.Snowflake): ?Model.GuildMember {
    const member = this._db
      .prepare(
        dedent`\
          SELECT
            user_id,
            nick
          FROM members
          WHERE user_id = :user_id
          `
      )
      .get({user_id: userId});

    if (!member) {
      return null;
    } else {
      return {
        user: NullUtil.get(this.user(userId), `No user_id found for ${userId}`),
        nick: member.nick,
      };
    }
  }

  channels(): $ReadOnlyArray<Model.Channel> {
    return this._db
      .prepare(
        dedent`\
          SELECT
            id,
            type,
            name
          FROM channels`
      )
      .all();
  }

  messages(channel: Model.Snowflake): $ReadOnlyArray<Model.Message> {
    return this._db
      .prepare(
        dedent`\
          SELECT
            id,
            channel_id,
            author_id,
            non_user_author,
            timestamp_ms,
            content
          FROM messages
          WHERE channel_id = :channel_id`
      )
      .all({channel_id: channel})
      .map((m) => ({
        id: m.id,
        channelId: m.channel_id,
        authorId: m.author_id,
        nonUserAuthor: m.non_user_author === 1,
        timestampMs: m.timestamp_ms,
        content: m.content,
        reactionEmoji: this.reactionEmoji(m.channel_id, m.id),
        mentions: this.mentions(m.channel_id, m.id),
      }));
  }

  reactions(
    channel: Model.Snowflake,
    message: Model.Snowflake
  ): $ReadOnlyArray<Model.Reaction> {
    return this._db
      .prepare(
        dedent`\
          SELECT
            channel_id,
            message_id,
            author_id,
            emoji
          FROM message_reactions
          WHERE channel_id = :channel_id
            AND message_id = :message_id`
      )
      .all({channel_id: channel, message_id: message})
      .map((r) => ({
        channelId: r.channel_id,
        messageId: r.message_id,
        authorId: r.author_id,
        emoji: Model.refToEmoji(r.emoji),
      }));
  }

  mentions(
    channel: Model.Snowflake,
    message: Model.Snowflake
  ): $ReadOnlyArray<Model.Snowflake> {
    return this._db
      .prepare(
        dedent`\
          SELECT user_id
          FROM message_mentions
          WHERE channel_id = :channel_id
            AND message_id = :message_id`
      )
      .all({channel_id: channel, message_id: message})
      .map((res) => res.user_id);
  }

  addUser(user: Model.User) {
    this._db
      .prepare(
        dedent`\
          REPLACE INTO users (
              id,
              username,
              discriminator,
              bot
          ) VALUES (
              :id,
              :username,
              :discriminator,
              :bot
          )
        `
      )
      .run({
        id: user.id,
        username: user.username,
        discriminator: user.discriminator,
        bot: Number(user.bot),
      });
  }

  /**
   * Because a User is represented in a Member object, we save the User in
   * `addMember`.
   */
  addMember(member: Model.GuildMember) {
    this.addUser(member.user);
    this._db
      .prepare(
        dedent`\
          REPLACE INTO members (
              user_id,
              nick
          ) VALUES (
              :user_id,
              :nick
          )
        `
      )
      .run({
        user_id: member.user.id,
        nick: member.nick,
      });
  }

  addChannel(channel: Model.Channel) {
    this._db
      .prepare(
        dedent`\
          REPLACE INTO channels (
              id,
              type,
              name
          ) VALUES (
              :id,
              :type,
              :name
          )
        `
      )
      .run({
        id: channel.id,
        type: channel.type,
        name: channel.name,
      });
  }

  addMessage(message: Model.Message) {
    this._db
      .prepare(
        dedent`\
          REPLACE INTO messages (
              id,
              channel_id,
              author_id,
              non_user_author,
              timestamp_ms,
              content
          ) VALUES (
              :id,
              :channel_id,
              :author_id,
              :non_user_author,
              :timestamp_ms,
              :content
          )
        `
      )
      .run({
        id: message.id,
        channel_id: message.channelId,
        author_id: message.authorId,
        non_user_author: Number(message.nonUserAuthor),
        timestamp_ms: message.timestampMs,
        content: message.content,
      });
  }

  addReaction(reaction: Model.Reaction) {
    this._db
      .prepare(
        dedent`\
          REPLACE INTO message_reactions (
              channel_id,
              message_id,
              author_id,
              emoji
          ) VALUES (
              :channel_id,
              :message_id,
              :author_id,
              :emoji
          )`
      )
      .run({
        channel_id: reaction.channelId,
        message_id: reaction.messageId,
        author_id: reaction.authorId,
        emoji: Model.emojiToRef(reaction.emoji),
      });
  }

  addMention(message: Model.Message, user: Model.Snowflake) {
    this._db
      .prepare(
        dedent`\
          REPLACE INTO message_mentions (
              channel_id,
              message_id,
              user_id
          ) VALUES (
              :channel_id,
              :message_id,
              :user_id
          )
        `
      )
      .run({
        channel_id: message.channelId,
        message_id: message.id,
        user_id: user,
      });
  }

  reactionEmoji(
    channel: Model.Snowflake,
    message: Model.Snowflake
  ): $ReadOnlyArray<Model.Emoji> {
    return this._db
      .prepare(
        dedent`\
         SELECT DISTINCT
           emoji
         FROM message_reactions
         WHERE channel_id = :channel_id
           AND message_id = :message_id`
      )
      .all({channel_id: channel, message_id: message})
      .map((e) => Model.refToEmoji(e.emoji));
  }

  // returns undefined if n is greater than the number of messages in the channel
  nthMessageIdFromTail(channel: Model.Snowflake, n: number): ?Model.Snowflake {
    return this._db
      .prepare(
        dedent`
          SELECT id
          FROM messages
          WHERE channel_id = :channel_id
          ORDER BY timestamp_ms DESC
          LIMIT 1
          OFFSET :offset
        `
      )
      .pluck()
      .get({channel_id: channel, offset: n - 1});
  }
}
