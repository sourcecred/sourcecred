// @flow

import type Database from "better-sqlite3";
import stringify from "json-stable-stringify";
import * as Model from "./models";
import dedent from "../../util/dedent";

const VERSION = "discord_mirror_v1";

export class SqliteMirrorRepository {
  +_db: Database;

  constructor(db: Database, guild: Model.Snowflake) {
    if (db == null) throw new Error("db: " + String(db));
    this._db = db;
    this._transaction(() => {
      this._initialize(guild);
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
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            name TEXT NOT NULL,
            parent_id TEXT
        )
      `,
      dedent`\
        CREATE TABLE members (
            user_id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            discriminator TEXT NOT NULL,
            bot INTEGER NOT NULL,
            nick TEXT
        )
      `,
      dedent`\
        CREATE TABLE member_roles (
            user_id TEXT,
            role TEXT NOT NULL,
            CONSTRAINT user_role PRIMARY KEY (user_id, role)
        )
      `,
      dedent`\
        CREATE TABLE messages (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            non_user_author INTEGER NOT NULL,
            timestamp_ms INTEGER NOT NULL,
            content TEXT NOT NULL
        )
      `,
      dedent`\
        CREATE TABLE message_reactions (
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            author_id TEXT NOT NULL,
            emoji TEXT NOT NULL,
            CONSTRAINT value_object PRIMARY KEY (channel_id, message_id, author_id, emoji)
        )
      `,
      dedent`\
        CREATE TABLE message_mentions (
            channel_id TEXT NOT NULL,
            message_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            count INTEGER NOT NULL,
            CONSTRAINT value_object PRIMARY KEY (channel_id, message_id, user_id)
        )
      `,
    ];
    for (const sql of tables) {
      db.prepare(sql).run();
    }
  }

  members(): $ReadOnlyArray<Model.GuildMember> {
    return this._db
      .prepare(
        dedent`\
        SELECT
          user_id,
          username,
          discriminator,
          bot,
          nick
        FROM members`
      )
      .all()
      .map((x) => ({
        user: {
          id: x.user_id,
          username: x.username,
          discriminator: x.discriminator,
          bot: x.bot === 1,
        },
        nick: x.nick,
        roles: this.memberRoles(x.user_id),
      }));
  }

  memberRoles(user: Model.Snowflake): $ReadOnlyArray<Model.Snowflake> {
    return this._db
      .prepare(
        dedent`\
        SELECT
          user_id,
          role
        FROM member_roles
        WHERE user_id = :user_id`
      )
      .all({user_id: user})
      .map((x) => x.role);
  }

  channels(): $ReadOnlyArray<Model.Channel> {
    return this._db
      .prepare(
        dedent`\
        SELECT
          id,
          type,
          name,
          parent_id
        FROM channels`
      )
      .all()
      .map((res) => ({
        id: res.id,
        type: res.type,
        name: res.name,
        parentId: res.parent_id,
      }));
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

  nthMessageFromTail(channel: Model.Snowflake, n: number): ?Model.Message {
    const count = this._db
      .prepare(
        dedent`\
        SELECT count(*) as count
        FROM messages
        WHERE channel_id = :channel_id`
      )
      .get({channel_id: channel}).count;

    if (count === 0) return null;
    const offset = count < n ? 0 : count - n;
    const m = this._db
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
        WHERE channel_id = :channel_id
        ORDER BY timestamp_ms
        LIMIT 1
        OFFSET :offset
        `
      )
      .get({channel_id: channel, offset});

    return {
      id: m.id,
      channelId: m.channel_id,
      authorId: m.author_id,
      nonUserAuthor: m.non_user_author === 1,
      timestampMs: m.timestamp_ms,
      content: m.content,
      reactionEmoji: this.reactionEmoji(m.channel_id, m.id),
      mentions: this.mentions(m.channel_id, m.id),
    };
  }

  mentions(
    channel: Model.Snowflake,
    message: Model.Snowflake
  ): $ReadOnlyArray<Model.Mention> {
    return this._db
      .prepare(
        dedent`\
        SELECT user_id, count
        FROM message_mentions
        WHERE channel_id = :channel_id
          AND message_id = :message_id`
      )
      .all({channel_id: channel, message_id: message})
      .map((res) => ({userId: res.user_id, count: res.count}));
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

  addChannel(channel: Model.Channel) {
    this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO channels (
              id,
              type,
              name,
              parent_id
          ) VALUES (
              :id,
              :type,
              :name,
              :parent_id
          )
        `
      )
      .run({
        id: channel.id,
        type: channel.type,
        name: channel.name,
        parent_id: channel.parentId || null,
      });
  }

  addMessage(message: Model.Message) {
    this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO messages (
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

    for (const mention of message.mentions) {
      this.addMention(message, mention);
    }
  }

  addReaction(reaction: Model.Reaction) {
    this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO message_reactions (
              channel_id,
              message_id,
              author_id,
              emoji
          ) VALUES (
              :channel_id,
              :message_id,
              :author_id,
              :emoji
          )
        `
      )
      .run({
        channel_id: reaction.channelId,
        message_id: reaction.messageId,
        author_id: reaction.authorId,
        emoji: Model.emojiToRef(reaction.emoji),
      });
  }

  addMention(message: Model.Message, mention: Model.Mention) {
    this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO message_mentions (
              channel_id,
              message_id,
              user_id,
              count
          ) VALUES (
              :channel_id,
              :message_id,
              :user_id,
              :count
          )
        `
      )
      .run({
        channel_id: message.channelId,
        message_id: message.id,
        user_id: mention.userId,
        count: mention.count,
      });
  }

  addMember(member: Model.GuildMember) {
    this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO members (
              user_id,
              username,
              discriminator,
              bot,
              nick
          ) VALUES (
              :user_id,
              :username,
              :discriminator,
              :bot,
              :nick
          )
        `
      )
      .run({
        user_id: member.user.id,
        username: member.user.username,
        discriminator: member.user.discriminator,
        bot: Number(member.user.bot),
        nick: member.nick || null,
      });

    for (const role of member.roles) {
      this.addMemberRole(member.user.id, role);
    }
  }

  addMemberRole(user: Model.Snowflake, role: Model.Snowflake) {
    this._db
      .prepare(
        dedent`\
          INSERT OR IGNORE INTO member_roles (
              user_id,
              role
          ) VALUES (
              :user_id,
              :role
          )
        `
      )
      .run({
        user_id: user,
        role,
      });
  }
}
