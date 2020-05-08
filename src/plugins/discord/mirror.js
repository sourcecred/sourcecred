// @flow

import {type DiscordFetcher, type ResultPage} from "./fetcher";
import {type SqliteMirror} from "./sqliteMirror";
import {type Snowflake} from "./models";
import * as Model from "./models";
import * as nullUtil from "../../util/null";

// Unused
// type FetchType<T> = (Snowflake) => Promise<ResultPage<T>>;

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

  async *_streamPages<T>(
    fetchPage: (endCursor: Snowflake) => Promise<ResultPage<T>>,
    endCursor: Snowflake
  ): AsyncGenerator<T, void, void> {
    let after = endCursor;
    let hasNextPage = true;

    while (hasNextPage) {
      const {results, pageInfo} = await fetchPage(after);
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

  _members(
    guildId: Snowflake,
    after: ?Snowflake
  ): AsyncGenerator<Model.GuildMember, void, void> {
    return this._streamPages(
      (after: Snowflake) => this._fetcher.members(guildId, after),
      after || "0"
    );
  }

  _messages(
    channel: Snowflake,
    after: ?Snowflake
  ): AsyncGenerator<Model.Message, void, void> {
    return this._streamPages(
      (after: Snowflake) => this._fetcher.messages(channel, after),
      after || "0"
    );
  }

  _reactions(
    channel: Snowflake,
    message: Snowflake,
    emoji: Model.Emoji,
    after: ?Snowflake
  ): AsyncGenerator<Model.Reaction, void, void> {
    return this._streamPages(
      (after: Snowflake) =>
        this._fetcher.reactions(channel, message, emoji, after),
      after || "0"
    );
  }

  async updateChannel(channel: Snowflake) {
    // TODO: don't load messages from "0" when we can use cache.
    const messages = this._messages(channel, "0");
    for await (const message of messages) {
      this._sqliteMirror.addMessage(message);

      for (const emoji of message.reactionEmoji) {
        const reactions = this._reactions(channel, message.id, emoji);
        for await (const reaction of reactions) {
          this._sqliteMirror.addReaction(reaction);
        }
      }
    }
  }

  async update() {
    // Updates the server members. We always get all of them.
    for await (const member of this._members(this._guildId)) {
      this._sqliteMirror.addMember(member);
    }

    const channels = await this._fetcher.channels(this._guildId);
    for (const channel of channels) {
      this._sqliteMirror.addChannel(channel);
      await this.updateChannel(channel.id);
    }
  }
}
