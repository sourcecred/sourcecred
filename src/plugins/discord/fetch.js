// @flow

import fetch from "isomorphic-fetch";

import {DepaginatedFetcher, getPages} from "./mirror";
import {DiscordFetcher, type FetchOptions} from "./fetcher";
import * as Model from "./models";
import {type Snowflake} from "./models";
import Database from "better-sqlite3";
import {fetchDiscord} from "./mirror";
import {SqliteMirror} from "./sqliteMirror";

export const DISCORD_SERVER = "https://discordapp.com/api";
const DISCORD_TOKEN_ENV_NAME = "SOURCECRED_DISCORD_BOT_TOKEN";

function buildDepaginatedFetcher(
  guildId: Snowflake,
  discordFetcher: DiscordFetcher
): DepaginatedFetcher {
  return {
    channels(): Promise<$ReadOnlyArray<Model.Channel>> {
      return discordFetcher.channels(guildId);
    },
    members(): Promise<$ReadOnlyArray<Model.GuildMember>> {
      const getMembers = (after: Snowflake) => {
        return discordFetcher.members(guildId, after);
      };
      return getPages(getMembers, "0");
    },
    messages(channel: Snowflake): Promise<$ReadOnlyArray<Model.Message>> {
      const getMessages = (after: Snowflake) => {
        return discordFetcher.messages(channel, after);
      };
      return getPages(getMessages, "0");
    },
    reactions(
      channel: Snowflake,
      message: Snowflake,
      emoji: Model.Emoji
    ): Promise<$ReadOnlyArray<Model.Reaction>> {
      const getReactions = (after: Snowflake) => {
        return discordFetcher.reactions(channel, message, emoji, after);
      };
      return getPages(getReactions, "0");
    },
  };
}

function getTokenFromEnv(): string {
  const token = process.env[DISCORD_TOKEN_ENV_NAME];
  if (token == null) {
    throw new Error(
      `No Discord token provided: please set ${DISCORD_TOKEN_ENV_NAME}`
    );
  }
  return token;
}

function handleErrors(response: Response) {
  // TODO: handle 50001
  if (response.status === 429) {
    // TODO: Retry strategy
    throw new Error("429");
  }
  if (response.status === 404) {
    throw new Error(`404 Not Found on: ${response.url}; maybe bad serverUrl?`);
  }
  if (response.status === 403) {
    throw new Error(`403 Forbidden: bad API username or key?\n${response.url}`);
  }
  if (response.status === 410) {
    throw new Error(`410 Gone`);
  }
  throw new Error(`FETCH ERROR\nresponse status: ${response.status}`);
}

export function buildDiscordFetch(fetch: typeof fetch, token: string) {
  return async (endpoint: string) => {
    const params = {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bot ${token}`,
      },
    };
    const url = new URL(`${DISCORD_SERVER}${endpoint}`).href;
    const response = await fetch(url, params);
    if (response.status !== 200 || response.status !== 201) {
      handleErrors(response);
    } else {
      return await response.json();
    }
  };
}

function buildSqliteMirror(guildId: string) {
  const db = new Database(`discord_${guildId}`);
  return new SqliteMirror(db, guildId);
}

export async function fetchDiscordServer(
  guildId: Snowflake,
  fetch: (string) => Promise<any>,
  fetchOptions: FetchOptions,
  sqliteMirror: SqliteMirror
) {
  const fetcher = new DiscordFetcher(fetch, fetchOptions);
  const depaginatedFetcher = buildDepaginatedFetcher(guildId, fetcher);
  await fetchDiscord(sqliteMirror, depaginatedFetcher);
}

export async function makefetchDiscordServer(guildId: Snowflake) {
  const fetchOptions = {
    membersLimit: 100,
    messagesLimit: 100,
    reactionsLimit: 100,
  };
  return fetchDiscordServer(
    guildId,
    buildDiscordFetch(fetch, getTokenFromEnv()),
    fetchOptions,
    buildSqliteMirror(guildId)
  );
}
