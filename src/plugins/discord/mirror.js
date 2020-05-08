// @flow

import {type DiscordFetcher, type ResultPage} from "./fetcher";
import {type SqliteMirror} from "./sqliteMirror";
import {type Snowflake} from "./models";
import * as Model from "./models";
import * as nullUtil from "../../util/null";

type FetchType<T> = (Snowflake) => Promise<ResultPage<T>>;

/**
 * Mirrors data from the Discord API into a local sqlite db.
 */
export class Mirror {
  +_guildId: Snowflake;
  +_sqliteMirror: SqliteMirror;
  +_fetcher: DiscordFetcher;

  constructor(
    guildId: Snowflake,
    sqliteMirror: SqliteMirror,
    fetcher: DiscordFetcher
  ) {
    this._guildId = guildId;
    this._sqliteMirror = sqliteMirror;
    this._fetcher = fetcher;
  }

  async *_paginatedFetch<T>(
    fetch: (endCursor: Snowflake) => Promise<ResultPage<T>>,
    endCursor: Snowflake
  ): AsyncGenerator<T, void, void> {
    let after = endCursor;
    let hasNextPage = true;

    while (hasNextPage) {
      const {results, pageInfo} = await fetch(after);
      for (const result of results) {
        yield result;
      }
      hasNextPage = pageInfo.hasNextPage;
      if (hasNextPage) {
        after = nullUtil.get(
          pageInfo.endCursor,
          `Found null endCursor with hasNextPage = true`
        );
      }
    }
  }

  async _fetchMembers(): Promise<void> {
    const fetchMembers: FetchType<Model.GuildMember> = async (
      after: Snowflake
    ) => {
      return await this._fetcher.members(this._guildId, after);
    };

    const members = this._paginatedFetch(fetchMembers, "0");
    for await (const member of members) {
      this._sqliteMirror.addMember(member);
    }
  }

  async _fetchReactions(
    channel: Snowflake,
    message: Snowflake,
    emoji: Model.Emoji
  ): Promise<void> {
    const fetchReactions: FetchType<Model.Reaction> = async (
      after: Snowflake
    ) => {
      return await this._fetcher.reactions(channel, message, emoji, after);
    };

    const reactions = this._paginatedFetch(fetchReactions, "0");
    for await (const reaction of reactions) {
      this._sqliteMirror.addReaction(reaction);
    }
  }

  async _fetchMessageDataInChannel(channel: Snowflake) {
    const fetchMessages: FetchType<Model.Message> = async (
      after: Snowflake
    ) => {
      return await this._fetcher.messages(channel, after);
    };

    const messages = this._paginatedFetch(fetchMessages, "0");
    for await (const message of messages) {
      this._sqliteMirror.addMessage(message);

      for (const emoji of message.reactionEmoji) {
        await this._fetchReactions(channel, message.id, emoji);
      }
    }
  }

  async update() {
    await this._fetchMembers();
    const channels = await this._fetcher.channels(this._guildId);
    for (const channel of channels) {
      this._sqliteMirror.addChannel(channel);
      await this._fetchMessageDataInChannel(channel.id);
    }
  }
}
