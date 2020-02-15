// @flow

import fetch from "isomorphic-fetch";
import * as Model from "./models";

export interface DiscordApi {
  guilds(): Promise<$ReadOnlyArray<Model.Guild>>;
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

  constructor(opts?: $Shape<FetcherOptions>) {
    this._options = {...fetcherDefaults, ...opts};
    if (!this._options.token) {
      throw new Error("A BotToken is required");
    }
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
    return this._options.fetch(`${apiUrl}${endpoint}`, requestOptions);
  }

  async guilds(): Promise<$ReadOnlyArray<Model.Guild>> {
    const res = await this._fetch("/users/@me/guilds");
    failIfMissing(res);
    failForNotOk(res);
    return (await res.json()).map((g) => ({
      id: g.id,
      name: g.name,
      permissions: g.permissions,
    }));
  }
}

function failIfMissing(response: Response) {
  if (response.status === 404) {
    throw new Error(`404 Not Found on: ${response.url}; maybe bad serverUrl?`);
  }
  if (response.status === 403) {
    throw new Error(`403 Forbidden: bad API username or key?`);
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
