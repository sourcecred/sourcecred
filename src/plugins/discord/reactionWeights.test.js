// @flow

import deepFreeze from "deep-freeze";
import type {Message, Reaction, GuildMember} from "./models";
import {
  _channelWeight,
  _roleWeight,
  _emojiWeight,
  reactionWeight,
} from "./reactionWeights";

describe("plugins/discord/reactionWeights", () => {
  const channelId = "1";
  const messageId = "2";
  const authorId = "4";
  const reacterId = "5";
  const badassRoleId = "6";
  const plebeRoleId = "7";
  const heartEmoji = {name: "💜", id: null};
  const sourcecredEmojiId = "8";
  const sourcecredEmoji = {name: "sourcecred", id: sourcecredEmojiId};

  const message: Message = deepFreeze({
    id: messageId,
    channelId,
    authorId,
    nonUserAuthor: false,
    timestampMs: 1,
    content: "hello world",
    reactionEmoji: [heartEmoji, sourcecredEmoji],
    mentions: [reacterId],
  });

  const authorMember: GuildMember = deepFreeze({
    user: {
      id: authorId,
      username: "author",
      discriminator: "1234",
      bot: false,
    },
    nick: null,
    roles: [],
  });

  const reacterMember: GuildMember = deepFreeze({
    user: {
      id: reacterId,
      username: "reacter",
      discriminator: "1337",
      bot: false,
    },
    nick: null,
    roles: [badassRoleId, plebeRoleId],
  });

  const authorSelfReaction: Reaction = deepFreeze({
    channelId,
    messageId,
    authorId,
    emoji: heartEmoji,
  });

  const reacterReaction: Reaction = deepFreeze({
    channelId,
    messageId,
    authorId: reacterId,
    emoji: sourcecredEmoji,
  });

  describe("_roleWeight", () => {
    const roleWeights = deepFreeze({
      defaultWeight: 0,
      weights: {[badassRoleId]: 3, [plebeRoleId]: 1},
    });
    it("defaults to the defaultWeight if no weights match", () => {
      expect(_roleWeight(roleWeights, authorMember)).toEqual(
        roleWeights.defaultWeight
      );
    });
    it("chooses the highest weight if multiple weights match", () => {
      expect(_roleWeight(roleWeights, reacterMember)).toEqual(
        roleWeights.weights[badassRoleId]
      );
    });
  });

  describe("_channelWeight", () => {
    it("defaults to the defaultWeight if no weights match", () => {
      const cw = {defaultWeight: 7, weights: {}};
      expect(_channelWeight(cw, authorSelfReaction)).toEqual(cw.defaultWeight);
    });
    it("chooses a matching channel weight", () => {
      const cw = {defaultWeight: 7, weights: {[channelId]: 99}};
      expect(_channelWeight(cw, authorSelfReaction)).toEqual(99);
    });
  });

  describe("_emojiWeight", () => {
    it("defaults to the defaultWeight if custom emoji weight not specified", () => {
      const ew = {defaultWeight: 7, weights: {}};
      expect(_emojiWeight(ew, authorSelfReaction)).toEqual(7);
    });
    it("can match an emoji weight for a builtin emoji", () => {
      const ew = {defaultWeight: 0, weights: {"💜": 9}};
      expect(_emojiWeight(ew, authorSelfReaction)).toEqual(9);
    });
    it("can match an emoji weight for a custom emoji", () => {
      const ew = {defaultWeight: 0, weights: {"sourcecred:8": 12}};
      expect(_emojiWeight(ew, reacterReaction)).toEqual(12);
    });
  });

  describe("reactionWeight", () => {
    it("multiplies the channel, message, and role weights", () => {
      const emojiWeights = {
        defaultWeight: 1,
        weights: {"💜": 3, "sourcecred:8": 4},
      };
      const roleWeights = {
        defaultWeight: 1,
        weights: {[badassRoleId]: 5, [plebeRoleId]: 3},
      };
      const channelWeights = {defaultWeight: 1, weights: {[channelId]: 6}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      expect(
        reactionWeight(weights, message, reacterReaction, reacterMember)
      ).toEqual(4 * 5 * 6);
    });
    it("sets the weight to 0 for a self-reaction", () => {
      const emojiWeights = {defaultWeight: 1, weights: {}};
      const roleWeights = {defaultWeight: 1, weights: {}};
      const channelWeights = {defaultWeight: 1, weights: {}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      expect(
        reactionWeight(weights, message, authorSelfReaction, authorMember)
      ).toEqual(0);
    });
  });
});
