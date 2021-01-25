// @flow

import {emojiToRef, refToEmoji, isAuthoredByNonUser} from "./models";

describe("plugins/wip-discord/models", () => {
  describe("model helper functions", () => {
    describe("emojiToRef", () => {
      it("returns name if id is null", () => {
        expect(emojiToRef({id: null, name: "🐙"})).toBe("🐙");
      });
      it("returns name and id if id is not null", () => {
        expect(emojiToRef({id: "id", name: "name"})).toBe("name:id");
      });
    });
    describe("refToEmoji", () => {
      it("returns correct object if id is null", () => {
        expect(refToEmoji("🐙")).toEqual({name: "🐙", id: null});
      });
      it("returns correct object if id is not null", () => {
        expect(refToEmoji("name:id")).toEqual({name: "name", id: "id"});
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
