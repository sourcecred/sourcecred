// @flow

import {emojiToRef, isAuthoredByNonUser} from "./models";

describe("plugins/discord/models", () => {
  describe("model helper functions", () => {
    describe("emojiToRef", () => {
      it("returns name if id is null", () => {
        expect(emojiToRef({id: null, name: "testEmojiName"})).toBe(
          "testEmojiName"
        );
      });
      it("returns name and id if id is not null", () => {
        expect(emojiToRef({id: "testEmojiId", name: "testEmojiName"})).toBe(
          "testEmojiName:testEmojiId"
        );
      });
    });
    describe("isAuthoredByNonUser", () => {
      it("returns true if webhook_id property is provided in message", () => {
        expect(isAuthoredByNonUser({webhook_id: "0"})).toBe(true);
      });
      it("returns false if webhook_id property is not provided in message", () => {
        expect(isAuthoredByNonUser({})).toBe(false);
      });
    });
  });
});
