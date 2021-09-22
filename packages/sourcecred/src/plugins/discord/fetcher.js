// @flow

import fetch from "isomorphic-fetch";
import * as Model from "./models";

export interface DiscordApi {
  guilds(): Promise<$ReadOnlyArray<Model.Guild>>;
  emojis(guild: Model.Snowflake): Promise<$ReadOnlyArray<Model.Emoji>>;
  channels(guild: Model.Snowflake): Promise<$ReadOnlyArray<Model.Channel>>;
  roles(guild: Model.Snowflake): Promise<$ReadOnlyArray<Model.Role>>;
  members(guild: Model.Snowflake): Promise<$ReadOnlyArray<Model.GuildMember>>;
  messages(
    channel: Model.Snowflake,
    after: Model.Snowflake,
    limit: number
  ): Promise<$ReadOnlyArray<Model.Message>>;
  reactions(
    channel: Model.Snowflake,
    message: Model.Snowflake,
    emoji: Model.Emoji
  ): Promise<$ReadOnlyArray<Model.Reaction>>;
}

const fetcherDefaults: FetcherOptions = {
  apiUrl: "https://discordapp.com/api",
  token: null,
  fetch,
};

type FetcherOptions = {|
  +apiUrl: string,
  +fetch: typeof fetch,
  +token: ?Model.BotToken,
|};

export class Fetcher implements DiscordApi {
  +_options: FetcherOptions;
  _timeout: number;

  constructor(opts?: $Shape<FetcherOptions>) {
    this._options = {...fetcherDefaults, ...opts};
    if (!this._options.token) {
      throw new Error("A BotToken is required");
    }
    this._timeout = 0;
  }

  _fetch(endpoint: string): Promise<Response> {
    const {apiUrl, token} = this._options;
    if (!token) {
      throw new Error("A BotToken is required");
    }
    const requestOptions = {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bot ${token}`,
      },
    };
    const url = new URL(`${apiUrl}${endpoint}`).href;
    return this._options.fetch(url, requestOptions);
  }

  async _wait() {
    const currentTime = Date.now();
    // if timeout hasn't passed, we wait until it does
    if (currentTime < this._timeout) {
      const restartDate = new Date(this._timeout);
      const waitTime = this._timeout - currentTime;
      console.warn(
        `Discord Rate limit reached. Waiting for ${
          waitTime / 1000
        } seconds (until ${restartDate.toLocaleString()})`
      );
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    }
  }

  _checkRateLimit(res: Response) {
    // The discord API returns this header to indicate how many requests remain
    // before hitting a cooldown.
    const rateLimitRemaining = Number(res.headers.get("x-ratelimit-remaining"));

    // The discord API returns this epoc time (in seconds) to let us know
    // when we can continue.
    const rateLimitReset = Number(res.headers.get("x-ratelimit-reset")) * 1000;

    // wait until the timeout passes  before attempting another query
    if (rateLimitRemaining === 0) {
      this._timeout = rateLimitReset;
    }
  }

  async _fetchJson(endpoint: string): Promise<any> {
    await this._wait();
    const res = await this._fetch(endpoint);
    failIfMissing(res);
    failForNotOk(res);
    this._checkRateLimit(res);
    return await res.json();
  }

  async guilds(): Promise<$ReadOnlyArray<Model.Guild>> {
    const guilds = await this._fetchJson("/users/@me/guilds");
    return guilds.map((x) => ({
      id: x.id,
      name: x.name,
      permissions: x.permissions,
    }));
  }

  async emojis(guild: Model.Snowflake): Promise<$ReadOnlyArray<Model.Emoji>> {
    const emojis = await this._fetchJson(`/guilds/${guild}/emojis`);
    return emojis.map((x) => ({
      id: x.id,
      name: x.name,
    }));
  }

  async channels(
    guild: Model.Snowflake
  ): Promise<$ReadOnlyArray<Model.Channel>> {
    const channels = await this._fetchJson(`/guilds/${guild}/channels`);
    return channels.map((x) => ({
      id: x.id,
      parentId: x.parent_id,
      name: x.name,
      type: Model.channelTypeFromId(x.type),
      nsfw: x.nsfw,
    }));
  }

  async roles(guild: Model.Snowflake): Promise<$ReadOnlyArray<Model.Role>> {
    const roles = await this._fetchJson(`/guilds/${guild}/roles`);
    return roles.map((x) => ({
      id: x.id,
      name: x.name,
    }));
  }

  async members(
    guild: Model.Snowflake
  ): Promise<$ReadOnlyArray<Model.GuildMember>> {
    const limit = 1000;
    let doneLoading = false;
    let allMembers = [];
    let after = "0";
    while (!doneLoading) {
      const newMembers: Array<Model.GuildMember> = await this._fetchJson(
        `/guilds/${guild}/members?after=${after}&limit=${limit}`
      );
      if (newMembers.length < limit) {
        doneLoading = true;
      } else {
        after = newMembers[newMembers.length - 1].user.id;
      }
      allMembers = [...allMembers, ...newMembers];
    }
    return allMembers.map((x) => ({
      user: {
        id: x.user.id,
        username: x.user.username,
        discriminator: x.user.discriminator,
        bot: x.user.bot || x.user.system || false,
      },
      nick: x.nick || null,
      roles: x.roles,
    }));
  }

  async messages(
    channel: Model.Snowflake,
    after: Model.Snowflake,
    limit: number
  ): Promise<$ReadOnlyArray<Model.Message>> {
    const messages = await this._fetchJson(
      `/channels/${channel}/messages?after=${after}&limit=${limit}`
    );
    return messages.map((x) => ({
      id: x.id,
      channelId: channel,
      authorId: x.author.id,
      timestampMs: Date.parse(x.timestamp),
      content: x.content,
      reactionEmoji: (x.reactions || []).map((r) => r.emoji),
      nonUserAuthor: x.webhook_id != null || false,
      mentions: (x.mentions || []).map((user) => ({
        userId: user.id,
        count: Array.from(x.content.matchAll(`<@!?${user.id}>`)).length,
      })),
    }));
  }

  async reactions(
    channel: Model.Snowflake,
    message: Model.Snowflake,
    emoji: Model.Emoji
  ): Promise<$ReadOnlyArray<Model.Reaction>> {
    let doneLoading = false;
    let allReactingUsers: Array<Model.User> = [];
    let after = "0";
    const limit = 100;
    const emojiRef = Model.emojiToRef(emoji);
    while (!doneLoading) {
      const newReactingUsers: Array<Model.User> = await this._fetchJson(
        `/channels/${channel}/messages/${message}/reactions/${emojiRef}?after=${after}&limit=${limit}`
      );
      if (newReactingUsers.length < limit) {
        doneLoading = true;
      } else {
        after = newReactingUsers[newReactingUsers.length - 1].id;
      }
      allReactingUsers = [...allReactingUsers, ...newReactingUsers];
    }

    return allReactingUsers.map((x) => ({
      channelId: channel,
      messageId: message,
      emoji,
      authorId: x.id,
    }));
  }
}

function failIfMissing(response: Response) {
  if (response.status === 404) {
    throw new Error(`404 Not Found on: ${response.url}; maybe bad serverUrl?`);
  }
  if (response.status === 403) {
    throw new Error(`403 Forbidden: bad API username or key?\n${response.url}`);
  }
  if (response.status === 410) {
    throw new Error(`410 Gone`);
  }
}

function failForNotOk(response: Response) {
  if (!response.ok) {
    throw new Error(`not OK status ${response.status} on ${response.url}`);
  }
}
