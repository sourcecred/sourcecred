// @flow

import deepFreeze from "deep-freeze";
import type {Message, Reaction, GuildMember} from "./models";
import {
  channelWeight,
  _roleWeight,
  _emojiWeight,
  reactionWeight,
} from "./reactionWeights";
import {type GraphReaction} from "./createGraph";

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
  const categoryId = "9";

  const message: Message = deepFreeze({
    id: messageId,
    channelId,
    authorId,
    nonUserAuthor: false,
    timestampMs: 1,
    content: "hello world",
    reactionEmoji: [heartEmoji, sourcecredEmoji],
    mentions: [{userId: reacterId, count: 1}],
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

  const reactions: $ReadOnlyArray<GraphReaction> = deepFreeze([
    {
      reaction: reacterReaction,
      reactingMember: reacterMember,
    },
    {
      reaction: authorSelfReaction,
      reactingMember: authorMember,
    },
  ]);

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

  describe("channelWeight", () => {
    it("defaults to the defaultWeight squared if no weights match", () => {
      const cw = {defaultWeight: 3, weights: {}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(9);
    });
    it("defaults to the 0 defaultWeight if no weights match", () => {
      const cw = {defaultWeight: 0, weights: {}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(
        cw.defaultWeight
      );
    });
    it("chooses a matching channel weight and defaults category weight", () => {
      const cw = {defaultWeight: 3, weights: {[channelId]: 2}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(6);
    });
    it("chooses a matching category weight and defaults channel weight", () => {
      const cw = {defaultWeight: 3, weights: {[categoryId]: 2}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(6);
    });
    it("chooses a matching channel weight when defaultWeight is 0", () => {
      const cw = {defaultWeight: 0, weights: {[channelId]: 2}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(2);
    });
    it("chooses a matching category weight when defaultWeight is 0", () => {
      const cw = {defaultWeight: 0, weights: {[categoryId]: 2}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(2);
    });
    it("multiplies category and channel weight", () => {
      const cw = {defaultWeight: 7, weights: {[categoryId]: 2, [channelId]: 2}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(4);
    });
    it("respects 0 channel weight", () => {
      const cw = {defaultWeight: 7, weights: {[categoryId]: 2, [channelId]: 0}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(0);
    });
    it("respects 0 category weight", () => {
      const cw = {defaultWeight: 7, weights: {[categoryId]: 0, [channelId]: 2}};
      expect(channelWeight(cw, channelId, categoryId)).toEqual(0);
    });
  });

  describe("_emojiWeight", () => {
    it("defaults to the defaultWeight if custom emoji weight not specified", () => {
      const ew = {defaultWeight: 7, weights: {}, applyAveraging: false};
      expect(_emojiWeight(ew, authorSelfReaction)).toEqual(7);
    });
    it("can match an emoji weight for a builtin emoji", () => {
      const ew = {defaultWeight: 0, weights: {"💜": 9}, applyAveraging: false};
      expect(_emojiWeight(ew, authorSelfReaction)).toEqual(9);
    });
    it("can match an emoji weight for a custom emoji", () => {
      const ew = {
        defaultWeight: 0,
        weights: {"sourcecred:8": 12},
        applyAveraging: false,
      };
      expect(_emojiWeight(ew, reacterReaction)).toEqual(12);
    });
  });

  describe("reactionWeight", () => {
    it("multiplies the channel, message, and role weights", () => {
      const emojiWeights = {
        defaultWeight: 1,
        weights: {"💜": 3, "sourcecred:8": 4},
        applyAveraging: false,
      };
      const roleWeights = {
        defaultWeight: 1,
        weights: {[badassRoleId]: 5, [plebeRoleId]: 3},
      };
      const channelWeights = {defaultWeight: 1, weights: {[channelId]: 6}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      expect(
        reactionWeight(
          weights,
          message,
          reacterReaction,
          reacterMember,
          new Set(),
          reactions
        )
      ).toEqual(4 * 5 * 6);
    });
    it("averages across role-weighted users when averaging is enabled", () => {
      const emojiWeights = {
        defaultWeight: 1,
        weights: {"💜": 3, "sourcecred:8": 4},
        applyAveraging: true,
      };
      const roleWeights = {
        defaultWeight: 1,
        weights: {[badassRoleId]: 5, [plebeRoleId]: 3},
      };
      const channelWeights = {defaultWeight: 1, weights: {[channelId]: 6}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      // This is the role weight of the reactor and excludes the author
      const expectedAveragingModifier = 5;
      expect(
        reactionWeight(
          weights,
          message,
          reacterReaction,
          reacterMember,
          new Set(),
          reactions
        )
      ).toEqual((4 * 5 * 6) / expectedAveragingModifier);
    });
    it("averaging is safe against divide-by-zero when all roles are zero", () => {
      const emojiWeights = {
        defaultWeight: 1,
        weights: {"💜": 3, "sourcecred:8": 4},
        applyAveraging: true,
      };
      const roleWeights = {
        defaultWeight: 0,
        weights: {[badassRoleId]: 0, [plebeRoleId]: 0},
      };
      const channelWeights = {defaultWeight: 1, weights: {[channelId]: 6}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      expect(
        reactionWeight(
          weights,
          message,
          reacterReaction,
          reacterMember,
          new Set(),
          reactions
        )
      ).toEqual(0);
    });
    it("dampens emoji average when dampener >0", () => {
      const emojiWeights = {
        defaultWeight: 1,
        weights: {"💜": 3, "sourcecred:8": 4},
        applyAveraging: true,
        confidenceDampener: 2,
      };
      const roleWeights = {
        defaultWeight: 1,
        weights: {[badassRoleId]: 5, [plebeRoleId]: 3},
      };
      const channelWeights = {defaultWeight: 1, weights: {[channelId]: 6}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      // This is the role weight of the reactor and excludes the author
      const expectedAveragingModifier = 7;
      expect(
        reactionWeight(
          weights,
          message,
          reacterReaction,
          reacterMember,
          new Set(),
          reactions
        )
      ).toEqual((4 * 5 * 6) / expectedAveragingModifier);
    });
    it("sets the weight to 0 for a self-reaction", () => {
      const emojiWeights = {
        defaultWeight: 1,
        weights: {},
        applyAveraging: false,
      };
      const roleWeights = {defaultWeight: 1, weights: {}};
      const channelWeights = {defaultWeight: 1, weights: {}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      expect(
        reactionWeight(
          weights,
          message,
          authorSelfReaction,
          authorMember,
          new Set(),
          reactions
        )
      ).toEqual(0);
    });
    it("sets a  nonzero-weight for a self-reaction in a props channel", () => {
      const emojiWeights = {
        defaultWeight: 5,
        weights: {},
        applyAveraging: false,
      };
      const roleWeights = {defaultWeight: 2, weights: {}};
      const channelWeights = {defaultWeight: 3, weights: {}};
      const weights = {emojiWeights, roleWeights, channelWeights};
      const propsChannelSet = new Set([message.channelId]);
      expect(
        reactionWeight(
          weights,
          message,
          authorSelfReaction,
          authorMember,
          propsChannelSet,
          reactions
        )
      ).toEqual(5 * 2 * 3 * 3);
    });
  });
});
