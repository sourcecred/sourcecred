// @flow

import {TaskReporter} from "../../util/taskReporter";
import {Fetcher} from "./fetch";
import {SqliteMirrorRepository} from "./mirrorRepository";
import * as Model from "./models";

export class Mirror {
  +_repo: SqliteMirrorRepository;
  +_fetcher: Fetcher;
  +_token: Model.SlackToken;
  +_name: string;

  constructor(
    repo: SqliteMirrorRepository,
    fetcher: Fetcher,
    token: Model.SlackToken,
    name: string
  ) {
    this._repo = repo;
    this._fetcher = fetcher;
    this._token = token;
    this._name = name;
  }
  /**
   * validate slack token
   * add members
   * add channels
   * add messages
   */
  async update(reporter: TaskReporter) {
    await this.validateToken();
    reporter.start(`slack/${this._name}`);
    await this.addMembers();
    const channels = await this.addChannels();
    for (const channel of channels) {
      reporter.start(`slack/${this._name}/#${channel.name}`);
      try {
        await this.addMessages(channel);
      } catch (e) {
        console.warn(e);
      }
      reporter.finish(`slack/${this._name}/#${channel.name}`);
    }
    reporter.finish(`slack/${this._name}`);
  }

  async validateToken() {
    //@todo
    // validate token semantics
    // validate bot's permissions
    // throw error on probz
    return true;
  }

  async addMembers() {
    const members = await this._fetcher.users();
    for (const member of members) {
      this._repo.addMember(member);
    }
  }

  async addChannels(): Promise<Array<Model.Conversation>> {
    const channels = await this._fetcher.channels();
    for (const channel of channels) {
      this._repo.addChannel(channel);
    }
    return channels;
  }

  async addMessages(channel: Model.Conversation) {
    const messagesOfChannel = await this._fetcher.messages(channel);
    for (const message of messagesOfChannel) {
      this._repo.addMessage(message);
    }
  }

}
