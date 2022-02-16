// @flow

import {TaskReporter} from "../../util/taskReporter";
import {type DiscordApi} from "./fetcher";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";
import type {DiscordConfig} from "./config";
import {channelWeight} from "./reactionWeights";

// How many messages for each channel to reload.
const RELOAD_DEPTH = 50;
// How many messages to fetch at a time.
const MESSAGE_FETCH_LIMIT = 100;

export class Mirror {
  +_repo: SqliteMirrorRepository;
  +_api: DiscordApi;
  +config: DiscordConfig;

  constructor(
    repo: SqliteMirrorRepository,
    api: DiscordApi,
    config: DiscordConfig
  ) {
    this._repo = repo;
    this._api = api;
    this.config = config;
  }

  async update(reporter: TaskReporter) {
    const guild = await this.validateGuildId();
    reporter.start(`discord/${guild.name}`);
    await this.addMembers();
    const channels = await this.addTextChannels();
    for (const channel of channels) {
      reporter.start(`discord/${guild.name}/#${channel.name}`);
      try {
        await this.addMessages(channel.id);
      } catch (e) {
        const warn = e?.message?.includes("403")
          ? "Skipping private channel."
          : e;
        console.warn(warn);
      }
      reporter.finish(`discord/${guild.name}/#${channel.name}`);
    }
    reporter.finish(`discord/${guild.name}`);
  }

  async validateGuildId(): Promise<{|
    +id: Model.Snowflake,
    +name: string,
    +permissions: number,
  |}> {
    const guilds = await this._api.guilds();
    const guild = guilds.find((g) => g.id === this.config.guildId);
    if (!guild) {
      throw new Error(
        `Couldn't find guild with ID ${this.config.guildId}\nMaybe the bot has no access to it?`
      );
    }
    // TODO: validate bot permissions
    return guild;
  }

  async addMembers(): Promise<$ReadOnlyArray<Model.GuildMember>> {
    const members = await this._api.members(this.config.guildId);
    for (const member of members) {
      this._repo.addMember(member);
    }
    return this._repo.members();
  }

  async addTextChannels(): Promise<$ReadOnlyArray<Model.Channel>> {
    const channels = await this._api.channels(this.config.guildId);
    for (const channel of channels) {
      if (channel.type !== "GUILD_TEXT") continue;
      if (
        !channelWeight(
          this.config.weights.channelWeights,
          channel.id,
          channel.parentId
        )
      )
        continue;
      if (!this.config.includeNsfwChannels && channel.nsfw) continue;
      this._repo.addChannel(channel);
    }
    return this._repo.channels();
  }

  async addMessages(
    channel: Model.Snowflake
  ): Promise<$ReadOnlyArray<Model.Message>> {
    let beginningTimestampMs =
      this._repo.nthMessageFromTail(channel, RELOAD_DEPTH)?.timestampMs ??
      this.config.beginningTimestampMs;
    let beforeId: Model.Snowflake = "";
    const run = async (_this) => {
      let page: $ReadOnlyArray<Model.Message> = [];
      let hasReachedBeginning = false;
      do {
        page = await _this._api.messages(
          channel,
          beforeId,
          MESSAGE_FETCH_LIMIT
        );
        for (const message of page) {
          if (message.timestampMs < beginningTimestampMs) {
            hasReachedBeginning = true;
            continue;
          }
          if (!beforeId || beforeId > message.id) {
            beforeId = message.id;
          }
          _this._repo.addMessage(message);
          for (const emoji of message.reactionEmoji) {
            const reactions = await _this._api.reactions(
              channel,
              message.id,
              emoji
            );
            for (const reaction of reactions) {
              _this._repo.addReaction(reaction);
            }
          }
        }
      } while (page.length >= MESSAGE_FETCH_LIMIT && !hasReachedBeginning);
    };
    await run(this);

    // If a previous load was interrupted, leaving an incomplete cache,
    // or the beginningDate config was changed to be earlier, this ensures
    // that the gap between the earliest message and the beginningDate is
    // filled.
    const firstMessage = this._repo.nthMessageFromTail(channel, Infinity);
    if (firstMessage) {
      beforeId = firstMessage.id;
      beginningTimestampMs = this.config.beginningTimestampMs;
      await run(this);
    }
    return this._repo.messages(channel);
  }
}
