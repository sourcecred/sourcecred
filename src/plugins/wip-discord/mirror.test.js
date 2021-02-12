// @flow

import Database from "better-sqlite3";
import {fetchDiscord, DepaginatedFetcher, getPages} from "./mirror";
import {SqliteMirror} from "./sqliteMirror";
import * as Model from "./models";
import {type Snowflake} from "./models";
import {
  testChannel,
  testMember,
  testMessage,
  customEmoji,
  testReaction,
  buildNMessages,
} from "./testUtils";

describe("plugins/wip-discord/mirror", () => {
  describe("updateMirror", () => {
    const activeChannelId = "12";
    const activeMessageid = "34";
    const activeAuthorId = "56";

    function testMirror() {
      const db = new Database(":memory:");
      return new SqliteMirror(db, "0");
    }

    function testMembers() {
      return [testMember(activeAuthorId), testMember("2"), testMember("3")];
    }

    function testChannels() {
      return [testChannel(activeChannelId), testChannel("2"), testChannel("3")];
    }

    function testMessages(channelId) {
      if (channelId === activeChannelId) {
        const reactionEmoji = [customEmoji()];
        return [
          testMessage(
            activeMessageid,
            channelId,
            activeAuthorId,
            reactionEmoji
          ),
          testMessage("2", channelId, activeAuthorId, []),
        ];
      } else {
        return [];
      }
    }

    function testReactions(channelId, messageId) {
      if (channelId === activeChannelId && messageId === activeMessageid) {
        return [
          testReaction(channelId, messageId, activeAuthorId),
          testReaction(channelId, messageId, "2"),
        ];
      } else {
        return [];
      }
    }

    function mockStream(): DepaginatedFetcher {
      return {
        members(): Promise<$ReadOnlyArray<Model.GuildMember>> {
          return Promise.resolve(testMembers());
        },
        channels(): Promise<$ReadOnlyArray<Model.Channel>> {
          return Promise.resolve(testChannels());
        },
        messages(channel: Snowflake): Promise<$ReadOnlyArray<Model.Message>> {
          return Promise.resolve(testMessages(channel));
        },
        reactions(
          channel: Snowflake,
          message: Snowflake
        ): Promise<$ReadOnlyArray<Model.Reaction>> {
          return Promise.resolve(testReactions(channel, message));
        },
      };
    }

    function setupTestData() {
      const mirror = testMirror();
      const stream = mockStream();
      return {mirror, stream};
    }

    it("fetches members", async () => {
      const {mirror, stream} = setupTestData();
      await fetchDiscord(mirror, stream);
      expect(mirror.members()).toEqual(testMembers());
    });
    it("fetches channels", async () => {
      const {mirror, stream} = setupTestData();
      await fetchDiscord(mirror, stream);
      expect(mirror.channels()).toEqual(testChannels());
    });
    it("fetches messages", async () => {
      const {mirror, stream} = setupTestData();
      await fetchDiscord(mirror, stream);
      expect(mirror.messages(activeChannelId)).toEqual(
        testMessages(activeChannelId)
      );
    });
    it("fetches reactions", async () => {
      const {mirror, stream} = setupTestData();
      await fetchDiscord(mirror, stream);
      expect(mirror.reactions(activeMessageid, activeChannelId)).toEqual(
        testReactions(activeMessageid, activeChannelId)
      );
    });
    it("refetch n messages defaults to 0 for endcursor", async () => {
      const {mirror, stream} = setupTestData();
      const spyFetchMessages = jest.spyOn(stream, "messages");
      await fetchDiscord(mirror, stream, 50);
      const expectedEndCursor = "0";
      expect(spyFetchMessages.mock.calls[0]).toEqual([
        activeChannelId,
        expectedEndCursor,
      ]);
    });
    it("refetches n messages", async () => {
      const {mirror, stream} = setupTestData();
      const spyFetchMessages = jest.spyOn(stream, "messages");
      buildNMessages(4, mirror, activeChannelId, activeMessageid);
      expect(mirror.messages(activeChannelId).map((x) => x.id)).toEqual([
        "1",
        "2",
        "3",
        "4",
      ]);
      await fetchDiscord(mirror, stream, 2);
      // there should be 5 messages saved in the db w/ ids: 0, 1, 2, 3, 4
      // expect the fetch plan to re-fetch 3 and 4, i.e. provide
      // call to fetch messages with 3 as starting endCursor
      const expectedEndCursor = "3";
      expect(spyFetchMessages.mock.calls[0]).toEqual([
        activeChannelId,
        expectedEndCursor,
      ]);
    });
  });

  describe("get pages", () => {
    it("handles pagination correctly", async () => {
      const fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            pageInfo: {hasNextPage: true, endCursor: "1"},
            results: [0, 1],
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            pageInfo: {hasNextPage: true, endCursor: "3"},
            results: [2, 3],
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            pageInfo: {hasNextPage: false, endCursor: "4"},
            results: [4],
          })
        );

      const results = await getPages(fetch, "0");
      expect(results).toEqual([0, 1, 2, 3, 4]);
      expect(fetch.mock.calls).toEqual([["0"], ["1"], ["3"]]);
    });
  });
});
