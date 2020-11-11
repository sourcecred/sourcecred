// @flow

const {WebClient} = require("@slack/web-api");
import type {SlackToken, User, Conversation, Message} from "./models";

export class Fetcher {
  +_token: SlackToken;
  web: any;

  constructor(token: SlackToken) {
    this._token = token;
    if (!token) {
      throw new Error("A Slack bot token is required");
    }
    this.web = new WebClient(token);
  }

  /**
   * Get all users from the Slack organisation
   */
  async users(): Promise<Array<User>> {
    const users: any = [];
    let cursor: any;
    let response: any;
    do {
      response = await this.web.users.list({
        limit: 100,
        include_locale: false,
        cursor,
      });
      const onlyHumans = await response.members.filter((member) => {
        return (
          member.is_bot !== true &&
          member.profile.real_name_normalized !== "Slackbot"
        );
      });
      for (const human of onlyHumans) {
        const oneHuman = {
          id: human.id,
          name: human.profile.real_name_normalized,
          email: human.profile.email,
        };
        users.push(oneHuman);
      }
      cursor = response.response_metadata.next_cursor;
    } while (response.response_metadata.next_cursor);
    return users;
  }

  /**
   * Get all channels (public and private) from the Slack org
   * Not considering Group DMs
   * will fetch only the channels where the app/bot is a part of
   * @todo only public channels and private channels considered for now, include `type` type for public,private,group dms etc.
   */
  async channels(): Array<Conversation> {
    const channels: any = [];
    let cursor: any;
    let response: any;
    const types = "public_channel, private_channel";
    do {
      try {
        response = await this.web.conversations.list({
          limit: 100,
          types,
          cursor,
        });
      } catch (error) {
        throw new Error("Error in fetching channels");
      }
      // filter the channels where bot is a member -- requirement to fetch message history
      const memberChannels = response.channels.filter((channel) => {
        return channel.is_member;
      });

      if (memberChannels.length) {
        // @todo cater to channels that are externally shared with other users or orgs (how to handle external identities?)
        for (let i = 0; i < memberChannels.length; i++) {
          channels.push({
            id: memberChannels[i].id,
            name: memberChannels[i].name,
          });
        }
      }
      cursor = response.response_metadata.next_cursor;
    } while (response.response_metadata.next_cursor);
    return channels;
  }

  async getRequiredDetails(
    message: any,
    channel: Conversation
  ): Promise<Message> {
    let block: any;
    const mentionedUsers: any = [];
    let innerElements: any;
    if (message.blocks) {
      block = message.blocks;
      block.forEach((element) => {
        for (const el of element.elements) {
          innerElements = el.elements;
        }
      });
      if (innerElements) {
        const mentionedUsersFilter = innerElements.filter(
          (el) => el.type === "user"
        );
        for (const user of mentionedUsersFilter) {
          mentionedUsers.push(user.user_id);
        }
      }
    }
    const detailedMessage = {
      id: message.ts,
      channel: channel.id,
      text: message.text,
      thread: message.thread_ts ? true : false,
      in_reply_to: message.thread_ts,
      authorId: message.user,
      reactions: message.reactions ? JSON.stringify(message.reactions) : "",
      mentions: mentionedUsers,
    };
    return detailedMessage;
  }

  async getAllReplies(
    timestamp: any,
    channel: Conversation
  ): Promise<Array<Message>> {
    let intermediateResult: any,
      cursor: any = "";
    let allReplies: any = [];
    do {
      try {
        intermediateResult = await this.web.conversations.replies({
          channel: channel.id,
          ts: timestamp,
          cursor
        });
      } catch (e) {
        throw new Error("Error in fetching replies");
      }
      allReplies.push(...intermediateResult.messages);
      cursor = intermediateResult.response_metadata.next_cursor;
    } while (intermediateResult.response_metadata.next_cursor);
    allReplies.shift();
    return allReplies;
  }

  /**
   * Given a conversation id (channel) fetches all messages of that channel
   */
  async messages(channel: Conversation): Promise<Array<Message>> {
    const messages: any = [];
    let cursor: any;
    let response: any;
    do {
      try {
        response = await this.web.conversations.history({
          channel: channel.id,
          cursor,
        });
      } catch (error) {
        throw new Error("Error in fetching messages");
      }
      const userMessages = response.messages.filter(
        (message) => !message.bot_id
      );

      // clean the message obj and fetch replies if any
      for (const msg of userMessages) {
        const requiredDetails = await this.getRequiredDetails(msg, channel);
        messages.push(requiredDetails);

        // fetch and push replies
        if (msg.thread_ts) {
          const responses = await this.getAllReplies(msg.ts, channel);
          for (const response of responses) {
            const details = await this.getRequiredDetails(response, channel);
            messages.push(details);
          }
        }
      }

      cursor = response.response_metadata.next_cursor;
    } while (response.response_metadata.next_cursor);
    return messages;
  }
}
