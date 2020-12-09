// @flow
import {
  _channelWeight,
  _emojiWeight,
  reactionWeight,
} from "./reactionWeights";
import {messagesMock} from "./testUtils/data.json"

describe("plugins/experimental-discord/reactionWeights", () => {
  const message = messagesMock[0];

  describe("_channelWeight", () => {
    it("defaults to the defaultWeight if no weights match", () => {
      const cw = {defaultWeight: 7, weights: {}};
      expect(_channelWeight(cw, message.channel)).toEqual(cw.defaultWeight);
    });
    it("chooses a matching channel weight", () => {
      const cw = {defaultWeight: 7, weights: {[message.channel]: 99}};
      expect(_channelWeight(cw, message.channel)).toEqual(99);
    });
  });

  describe("_emojiWeight", () => {
    const react = "purple_heart";
    it("defaults to the defaultWeight if custom emoji weight not specified", () => {
      const ew = {defaultWeight: 7, weights: {}};
      expect(_emojiWeight(ew, react)).toEqual(7);
    });
    it("can match an emoji weight for a builtin emoji", () => {
      const ew = {defaultWeight: 7, weights: {["purple_heart"]: 99}};
      expect(_emojiWeight(ew, react)).toEqual(99);
    });
  });

  describe("reactionWeight", () => {
    it("multiplies the channel, message, and role weights", () => {
      const emojiWeights = {
        defaultWeight: 1,
        weights: {"purple_heart": 4, "sourcecred": 4},
      };
      const channelWeights = {
        defaultWeight: 1, 
        weights: {"C01CPGVGXSB": 6}
      };
      const weights = {emojiWeights, channelWeights};
      expect(
        reactionWeight(weights, message, message.reactions[0].name, message.reactions[0].users[0], message.authorId, message.channel)
      ).toEqual(4 * 6);
    });
    it("sets the weight to 0 for a self-reaction", () => {
      const emojiWeights = {defaultWeight: 1, weights: {}};
      const channelWeights = {defaultWeight: 1, weights: {}};
      const weights = {emojiWeights, channelWeights};
      expect(
        reactionWeight(weights, message, message.reactions[0].name, message.reactions[0].users[1], message.authorId, message.channel)
      ).toEqual(0);
    });
  });
});
