// @flow

import {TaskReporter} from "../../util/taskReporter";
import {type DiscordApi} from "./fetcher";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";

export class Mirror {
  +_repo: SqliteMirrorRepository;
  +_api: DiscordApi;
  +guild: Model.Snowflake;

  constructor(
    repo: SqliteMirrorRepository,
    api: DiscordApi,
    guild: Model.Snowflake
  ) {
    this._repo = repo;
    this._api = api;
    this.guild = guild;
  }

  async update(reporter: TaskReporter) {
    reporter.start(`discord-${this.guild}`);
    await this.addMembers();
    const channels = await this.addTextChannels();
    for (const channel of channels) {
      await this.addMessages(channel.id);
    }
    reporter.finish(`discord-${this.guild}`);
  }

  async addMembers() {
    const members = await this._api.members(this.guild);
    for (const member of members) {
      this._repo.addMember(member);
    }
    return this._repo.members();
  }

  async addTextChannels() {
    const channels = await this._api.channels(this.guild);
    for (const channel of channels) {
      if (channel.type !== "GUILD_TEXT") continue;
      this._repo.addChannel(channel);
    }
    return this._repo.channels();
  }

  async addMessages(channel: Model.Snowflake, messageLimit?: number) {
    const limit = messageLimit || 100;
    let page: $ReadOnlyArray<Model.Message> = [];
    let after: Model.Snowflake = "0";
    do {
      page = await this._api.messages(channel, after, limit);
      for (const message of page) {
        after = after < message.id ? message.id : after;
        this._repo.addMessage(message);
        for (const emoji of message.reactionEmoji) {
          const reactions = await this._api.reactions(
            channel,
            message.id,
            emoji
          );
          for (const reaction of reactions) {
            this._repo.addReaction(reaction);
          }
        }
      }
    } while (page.length >= limit);
    return this._repo.messages(channel);
  }
}
