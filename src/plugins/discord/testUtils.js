// @flow

import {
  type Channel,
  type Message,
  type GuildMember,
  type Snowflake,
  type Emoji,
  type User,
} from "./models";

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
  authorId: Snowflake
): Message => ({
  id: id,
  channelId: channelId,
  authorId: authorId,
  timestampMs: Date.parse("2020-03-03T23:35:10.615000+00:00"),
  content: "Just going to drop this here",
  reactionEmoji: [customEmoji()],
  nonUserAuthor: false,
  mentions: ["1", "23"],
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
