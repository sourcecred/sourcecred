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

  async _paginatedFetch<T>(
    fetch: (endCursor: Snowflake) => Promise<ResultPage<T>>,
    process: (object: T) => void | Promise<void>,
    endCursor: Snowflake
  ): Promise<void> {
    let after = endCursor;
    let hasNextPage = true;

    while (hasNextPage) {
      const {results, pageInfo} = await fetch(after);
      for (const result of results) {
        await process(result);
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

    const processMember: (Model.GuildMember) => void = (
      member: Model.GuildMember
    ) => this._sqliteMirror.addMember(member);

    await this._paginatedFetch(fetchMembers, processMember, "0");
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

    const processReaction: (Model.Reaction) => void = (
      reaction: Model.Reaction
    ) => this._sqliteMirror.addReaction(reaction);

    await this._paginatedFetch(fetchReactions, processReaction, "0");
  }

  async _fetchMessageDataInChannel(channel: Snowflake) {
    const fetchMessages: FetchType<Model.Message> = async (
      after: Snowflake
    ) => {
      return await this._fetcher.messages(channel, after);
    };

    const processMessage: (Model.Message) => Promise<void> = async (
      msg: Model.Message
    ) => {
      this._sqliteMirror.addMessage(msg);

      for (const emoji of msg.reactionEmoji) {
        await this._fetchReactions(channel, msg.id, emoji);
      }
    };
    await this._paginatedFetch(fetchMessages, processMessage, "0");
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
