// @flow

/**
 * @jest-environment node
 */

import Database from "better-sqlite3";
import * as Model from "../models.js";
import {SqliteMirrorRepository} from "../mirrorRepository.js";

describe("plugins/slack/mirrorRepository", () => {
  let repo;
  beforeEach(() => {
    repo = new SqliteMirrorRepository(new Database(":memory:"));
  });
  it("initialises the tables correctly", () => {
    const stmt = repo._db.prepare("select * from meta");
    const get = stmt.all();
    expect(get[0].zero).toEqual(0);
    expect(get[0].config).toEqual(`{"version":"slack_mirror_v0"}`);
  });
  it("adds to channels table", () => {
    const channel: Model.Conversation = {
      id: "123",
      name: "Test",
    };
    repo.addChannel(channel);
    const stmt = repo._db.prepare(
      "select * from channels where channel_id = ?"
    );
    const get = stmt.get(channel.id);
    expect(get.name).toEqual(channel.name);
  });
  it("adds to members table", () => {
    const member: Model.User = {
      id: "user1",
      name: "Test Name",
      email: "test@email.com",
    };
    repo.addMember(member);
    const stmt = repo._db.prepare("select * from members where user_id = ?");
    const get = stmt.get(member.id);
    expect(get.name).toEqual(member.name);
    expect(get.email).toEqual(member.email);
  });
  it("adds to messages table", () => {
    // need to insert a member before adding the message - foreign key constraint
    const member: Model.User = {
      email: "test@email.com",
      id: "user1",
      name: "Test Name",
    };
    repo.addMember(member);
    const message: Model.Message = {
      id: "1603782590.000300",
      channel: "C01CPGVGXSB",
      text: "<@U01D48KV0HY> tagging me here",
      thread: true,
      in_reply_to: "1603782590.000300",
      authorId: "U01D48KV0HY",
      reactions: [
        {"name": "heart", "users": ["U01D48KV0HY"], "count": 1},
        {"name": "open_mouth", "users": ["U01D48KV0HY"], "count": 1},
      ],
      mentions: ["U01D48KV0HY"],
    };

    repo.addMessage(message);

    const messages = repo._db
      .prepare(
        "select * from messages where channel_id = ? and timestamp_ms = ?"
      )
      .get(message.channel, message.id);
    expect(messages.message_body).toEqual(message.text);
    expect(messages.author_id).toEqual(message.authorId);

    const messageReactions = repo._db
      .prepare(
        "select * from message_reactions where channel_id = ? and message_ts = ?"
      )
      .all(message.channel, message.id);
    let totalReactions = 0;
    for (const reaction of message.reactions) {
      totalReactions += reaction.count;
    }
    expect(messageReactions.length).toEqual(totalReactions);

    const messageMentions = repo._db
      .prepare("select * from message_mentions where message_id = ?")
      .all(message.id);
    expect(messageMentions.length).toEqual(message.mentions.length);
  });
});
