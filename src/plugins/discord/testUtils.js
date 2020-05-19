// @flow

import {
  type Channel,
  type Message,
  type GuildMember,
  type Snowflake,
  type Emoji,
  type User,
  type Reaction,
} from "./models";
import {type SqliteMirror} from "./sqliteMirror";

export const customEmoji = (): Emoji => ({id: "id", name: "name"});
export const genericEmoji = (): Emoji => ({id: null, name: "🐙"});

export const testChannel = (id: Snowflake): Channel => ({
  id: id,
  name: "testChannelName",
  type: "GUILD_TEXT",
});

export const testMessage = (
  id: Snowflake,
  channelId: Snowflake,
  authorId: Snowflake,
  reactionEmoji: ?$ReadOnlyArray<Emoji>,
  mentions: ?$ReadOnlyArray<Snowflake>
): Message => ({
  id: id,
  channelId: channelId,
  authorId: authorId,
  timestampMs: Number(id) * 2,
  content: "Just going to drop this here",
  reactionEmoji: reactionEmoji || [],
  nonUserAuthor: false,
  mentions: mentions || [],
});

export const testUser = (id: Snowflake): User => ({
  id: id,
  username: "username",
  discriminator: "disc",
  bot: true,
});

export const testMember = (userId: Snowflake): GuildMember => ({
  user: testUser(userId),
  nick: "nickname",
});

export const testReaction = (
  channelId: Snowflake,
  messageId: Snowflake,
  authorId: Snowflake
): Reaction => {
  return {
    channelId: channelId,
    messageId: messageId,
    authorId: authorId,
    emoji: customEmoji(),
  };
};

// creates n messages indexed from 1 and saves them to provided sqliteMirror
export function buildNMessages(
  n: number,
  sqliteMirror: SqliteMirror,
  channelId: Snowflake,
  authorId: Snowflake
) {
  sqliteMirror.addUser(testUser(authorId));
  sqliteMirror.addChannel(testChannel(channelId));

  for (let x = 1; x <= n; x++) {
    const message = {
      id: String(x),
      channelId: channelId,
      authorId: authorId,
      timestampMs: Number(x) * 2,
      content: "content",
      reactionEmoji: [],
      nonUserAuthor: false,
      mentions: [],
    };
    sqliteMirror.addMessage(message);
  }
}
