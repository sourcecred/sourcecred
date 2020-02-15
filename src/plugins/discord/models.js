// @flow

type Snowflake = string;

export type GuildId = Snowflake;

export type Guild = {|
  +id: GuildId,
  +name: string,
  +permissions: number,
|};

export type BotToken = string;
