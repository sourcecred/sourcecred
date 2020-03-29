// @flow

import Database from "better-sqlite3";
import {type DiscordFetcher, type ResultPage} from "./fetcher";
import {Mirror} from "./mirror";
import {SqliteMirror} from "./sqliteMirror";
import * as Model from "./models";
import {type Snowflake} from "./models";
import {testChannel, testMember, customEmoji, genericEmoji} from "./testUtils";

/**
 * These options allow us to parameterize the return values of MockFetcher
 */
type MockFetcherOptions = {|
  channels: (guildId: Snowflake) => Promise<$ReadOnlyArray<Model.Channel>>,
  members: (
    guildId: Snowflake,
    after: Snowflake
  ) => Promise<ResultPage<Model.GuildMember>>,
  messages: (
    channel: Snowflake,
    after: Snowflake
  ) => Promise<ResultPage<Model.Message>>,
  reactions: (
    channel: Snowflake,
    message: Snowflake,
    emoji: Model.Emoji,
    after: Snowflake
  ) => Promise<ResultPage<Model.Reaction>>,
|};

/**
 * A mock class to test return types from Discord's server.
 */
class MockFetcher implements DiscordFetcher {
  +_options: MockFetcherOptions;

  constructor(options: MockFetcherOptions) {
    this._options = options;
  }

  channels(guildId: Snowflake): Promise<$ReadOnlyArray<Model.Channel>> {
    return this._options.channels(guildId);
  }

  members(
    guildId: Snowflake,
    after: Snowflake
  ): Promise<ResultPage<Model.GuildMember>> {
    return this._options.members(guildId, after);
  }

  messages(
    channel: Snowflake,
    after: Snowflake
  ): Promise<ResultPage<Model.Message>> {
    return this._options.messages(channel, after);
  }

  reactions(
    channel: Snowflake,
    message: Snowflake,
    emoji: Model.Emoji,
    after: Snowflake
  ): Promise<ResultPage<Model.Reaction>> {
    return this._options.reactions(channel, message, emoji, after);
  }
}

describe("plugins/discord/mirror", () => {
  const emptyMembers = jest.fn().mockImplementation(() =>
    Promise.resolve({
      results: [],
      pageInfo: {hasNextPage: false, endCursor: null},
    })
  );

  const emptyMessages = jest.fn().mockImplementation(() =>
    Promise.resolve({
      results: [],
      pageInfo: {hasNextPage: false, endCursor: null},
    })
  );

  const emptyReactions = jest.fn().mockImplementation(() =>
    Promise.resolve({
      results: [],
      pageInfo: {hasNextPage: false, endCursor: null},
    })
  );

  const emptyChannels = jest.fn().mockImplementation(() => Promise.resolve([]));

  describe("update", () => {
    it("fetches channels", async () => {
      const guildId = "0";
      const db = new Database(":memory:");
      const sqliteMirror = new SqliteMirror(db, guildId);

      const channels = jest
        .fn()
        .mockImplementation(() =>
          Promise.resolve([testChannel("1"), testChannel("2")])
        );
      const fetcher = new MockFetcher({
        channels,
        members: emptyMembers,
        messages: emptyMessages,
        reactions: emptyReactions,
      });
      const mirror = new Mirror(guildId, sqliteMirror, fetcher);
      await mirror.update();
      expect(sqliteMirror.channels()).toEqual([
        testChannel("1"),
        testChannel("2"),
      ]);
    });

    it("fetches members", async () => {
      const guildId = "0";
      const db = new Database(":memory:");
      const sqliteMirror = new SqliteMirror(db, guildId);

      const members = jest
        .fn()
        .mockImplementationOnce(() => {
          return Promise.resolve({
            results: [testMember("1"), testMember("2")],
            pageInfo: {hasNextPage: true, endCursor: "2"},
          });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            results: [testMember("3")],
            pageInfo: {hasNextPage: false, endCursor: "3"},
          });
        });

      const fetcher = new MockFetcher({
        channels: emptyChannels,
        members,
        messages: emptyMessages,
        reactions: emptyReactions,
      });
      const mirror = new Mirror(guildId, sqliteMirror, fetcher);
      await mirror.update();
      expect(sqliteMirror.members()).toEqual([
        testMember("1"),
        testMember("2"),
        testMember("3"),
      ]);
    });
    it("fetches messages", async () => {
      const guildId = "1";
      const channelId = "2";
      const authorId = "3";
      const db = new Database(":memory:");
      const sqliteMirror = new SqliteMirror(db, guildId);

      const testMessage = (id: Snowflake): Model.Message => ({
        id: id,
        channelId: channelId,
        authorId: authorId,
        timestampMs: Date.parse("2020-03-03T23:35:10.615000+00:00"),
        content: "Test message content",
        reactionEmoji: [],
        nonUserAuthor: false,
        mentions: [],
      });

      const channels = jest
        .fn()
        .mockImplementation(() => Promise.resolve([testChannel(channelId)]));

      const members = jest.fn().mockImplementationOnce(() => {
        return Promise.resolve({
          results: [testMember(authorId)],
          pageInfo: {hasNextPage: false, endCursor: authorId},
        });
      });

      const messages = jest
        .fn()
        .mockImplementationOnce(() => {
          return Promise.resolve({
            results: [testMessage("1"), testMessage("2")],
            pageInfo: {hasNextPage: true, endCursor: "2"},
          });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            results: [testMessage("3")],
            pageInfo: {hasNextPage: false, endCursor: "3"},
          });
        });

      const fetcher = new MockFetcher({
        channels,
        members,
        messages,
        reactions: emptyReactions,
      });

      const mirror = new Mirror(guildId, sqliteMirror, fetcher);
      await mirror.update();
      expect(sqliteMirror.messages(channelId)).toEqual([
        testMessage("1"),
        testMessage("2"),
        testMessage("3"),
      ]);
      expect(messages.mock.calls).toEqual([
        [channelId, "0"],
        [channelId, "2"],
      ]);
    });

    it("fetches reactions", async () => {
      const guildId = "1";
      const channelId = "2";
      const authorId = "3";
      const messageId = "4";
      const reactionAuthorId1 = "5";
      const reactionAuthorId2 = "6";
      const reactionAuthorId3 = "7";
      const db = new Database(":memory:");
      const sqliteMirror = new SqliteMirror(db, guildId);

      const testMessage = (id: Snowflake): Model.Message => ({
        id: id,
        channelId: channelId,
        authorId: authorId,
        timestampMs: Date.parse("2020-03-03T23:35:10.615000+00:00"),
        content: "Test message content",
        reactionEmoji: [customEmoji(), genericEmoji()],
        nonUserAuthor: false,
        mentions: [],
      });

      const testReaction1 = (): Model.Reaction => {
        return {
          channelId: channelId,
          messageId: messageId,
          authorId: reactionAuthorId1,
          emoji: customEmoji(),
        };
      };

      const testReaction2 = (): Model.Reaction => {
        return {
          channelId: channelId,
          messageId: messageId,
          authorId: reactionAuthorId2,
          emoji: genericEmoji(),
        };
      };

      const testReaction3 = (): Model.Reaction => {
        return {
          channelId: channelId,
          messageId: messageId,
          authorId: reactionAuthorId3,
          emoji: genericEmoji(),
        };
      };

      const channels = jest
        .fn()
        .mockImplementation(() => Promise.resolve([testChannel(channelId)]));

      const members = jest.fn().mockImplementationOnce(() => {
        return Promise.resolve({
          results: [
            testMember(authorId),
            testMember(reactionAuthorId1),
            testMember(reactionAuthorId2),
            testMember(reactionAuthorId3),
          ],
          pageInfo: {hasNextPage: false, endCursor: "1"},
        });
      });

      const messages = jest.fn().mockImplementationOnce(() => {
        return Promise.resolve({
          results: [testMessage(messageId)],
          pageInfo: {hasNextPage: false, endCursor: "1"},
        });
      });

      const reactions = jest
        .fn()
        .mockImplementationOnce(() => {
          return Promise.resolve({
            results: [testReaction1()],
            pageInfo: {hasNextPage: false, endCursor: "0"},
          });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            results: [testReaction2()],
            pageInfo: {hasNextPage: true, endCursor: "1"},
          });
        })
        .mockImplementationOnce(() => {
          return Promise.resolve({
            results: [testReaction3()],
            pageInfo: {hasNextPage: false, endCursor: "2"},
          });
        });

      const fetcher = new MockFetcher({channels, members, messages, reactions});

      const mirror = new Mirror(guildId, sqliteMirror, fetcher);
      await mirror.update();
      expect(sqliteMirror.reactions(channelId, messageId)).toEqual([
        testReaction1(),
        testReaction2(),
        testReaction3(),
      ]);
      expect(reactions.mock.calls).toEqual([
        [channelId, messageId, customEmoji(), "0"],
        [channelId, messageId, genericEmoji(), "0"],
        [channelId, messageId, genericEmoji(), "1"],
      ]);
    });
  });
  describe("paginated fetch", () => {
    it("calls fetch and processes results", async () => {
      const guildId = "0";
      const db = new Database(":memory:");
      const sqliteMirror = new SqliteMirror(db, guildId);
      const fetcher = new MockFetcher({
        channels: emptyChannels,
        members: emptyMembers,
        messages: emptyMessages,
        reactions: emptyReactions,
      });
      const mirror = new Mirror(guildId, sqliteMirror, fetcher);

      const fetch = jest
        .fn()
        .mockImplementationOnce(() =>
          Promise.resolve({
            results: [1, 2],
            pageInfo: {hasNextPage: true, endCursor: "2"},
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            results: [3, 4],
            pageInfo: {hasNextPage: true, endCursor: "4"},
          })
        )
        .mockImplementationOnce(() =>
          Promise.resolve({
            results: [5],
            pageInfo: {hasNextPage: false, endCursor: "5"},
          })
        );

      const process = jest.fn();
      await mirror._paginatedFetch(fetch, process, "0");

      expect(fetch.mock.calls).toEqual([["0"], ["2"], ["4"]]);
      expect(process.mock.calls).toEqual([[1], [2], [3], [4], [5]]);
    });
  });
});
