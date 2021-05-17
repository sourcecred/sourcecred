// @flow

// https://discordapp.com/developers/docs/reference#snowflakes
export type Snowflake = string;
export const ZeroSnowflake: Snowflake = "0";

export type Guild = {|
  +id: Snowflake,
  +name: string,
  +permissions: number,
|};

export type BotToken = string;

// https://discordapp.com/developers/docs/resources/channel#channel-object-channel-types
export type ChannelType =
  | "GUILD_TEXT"
  | "DM"
  | "GUILD_VOICE"
  | "GROUP_DM"
  | "GUILD_CATEGORY"
  | "GUILD_NEWS"
  | "GUILD_STORE"
  | "UNKNOWN";

export function channelTypeFromId(id: number): ChannelType {
  switch (id) {
    case 0:
      return "GUILD_TEXT";
    case 1:
      return "DM";
    case 2:
      return "GUILD_VOICE";
    case 3:
      return "GROUP_DM";
    case 4:
      return "GUILD_CATEGORY";
    case 5:
      return "GUILD_NEWS";
    case 6:
      return "GUILD_STORE";
    default: {
      return "UNKNOWN";
    }
  }
}

export type Channel = {|
  +id: Snowflake,
  +type: ChannelType,
  +name: string,
  +nsfw?: boolean,
|};

export type Role = {|
  +id: Snowflake,
  +name: string,
|};

export type User = {|
  +id: Snowflake,
  +username: string,
  +discriminator: string,
  +bot: boolean,
|};

export type GuildMember = {|
  +user: User,
  +nick: ?string,
  +roles: $ReadOnlyArray<Snowflake>,
|};

export type Emoji = {|
  +id: ?Snowflake,
  +name: string,
|};

export type EmojiRef = string;

export function emojiToRef({id, name}: Emoji): EmojiRef {
  // Built-in emoji, unicode names.
  if (!id) return name;

  // Custom emoji.
  return `${name}:${id}`;
}

export function refToEmoji(ref: EmojiRef): Emoji {
  const [name, id] = ref.split(":");
  if (!id) return {id: null, name};
  return {id, name};
}

export type Message = {|
  +id: Snowflake,
  +channelId: Snowflake,
  +authorId: Snowflake,
  // Could be a message from a webhook, meaning the authorId isn't a user.
  +nonUserAuthor: boolean,
  +timestampMs: number,
  +content: string,
  // Normally includes reaction counters, but we don't care about counters.
  // We could filter based on which types of emoji have been added though.
  +reactionEmoji: $ReadOnlyArray<Emoji>,
  // Snowflake of user IDs.
  +mentions: $ReadOnlyArray<Mention>,
|};

export type Mention = {|
  +userId: Snowflake,
  +count: number,
|};

export type Reaction = {|
  +channelId: Snowflake,
  +messageId: Snowflake,
  +authorId: Snowflake,
  +emoji: Emoji,
|};
