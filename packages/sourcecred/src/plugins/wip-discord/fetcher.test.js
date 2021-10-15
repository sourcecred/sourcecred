// @flow

import {DiscordFetcher} from "./fetcher";
import {
  type Channel,
  type Guild,
  type Reaction,
  type Message,
  type GuildMember,
  type Emoji,
} from "./models";
import {testChannel} from "./testUtils";

/**
 * Note: the 'any' type signature is assigned to server response objects
 * to make explicit that they are untyped prior to transformation by the
 * appropriate handlers
 */

describe("plugins/wip-discord/fetcher", () => {
  const defaultOptions = () => ({
    membersLimit: 100,
    messagesLimit: 100,
    reactionsLimit: 100,
  });

  describe("fetch guild", () => {
    it("passes correct endpoint", async () => {
      const fetch = jest.fn(() => Promise.resolve([]));
      const fetcher = new DiscordFetcher(fetch, defaultOptions());
      await fetcher.guild("1");
      expect(fetch.mock.calls[0]).toEqual(["guilds/1"]);
    });

    it("handles response", async () => {
      const expected: Guild = {id: "1", name: "guildname", permissions: 0};
      const fetch = jest.fn(() => Promise.resolve(expected));
      const fetcher = new DiscordFetcher(fetch, defaultOptions());
      const guild = await fetcher.guild("1");
      expect(guild).toEqual(expected);
    });
  });

  describe("fetch channels", () => {
    it("passes correct endpoint", async () => {
      const fetch = jest.fn(() => Promise.resolve([]));
      const fetcher = new DiscordFetcher(fetch, defaultOptions());
      await fetcher.channels("1");
      expect(fetch.mock.calls[0]).toEqual(["/guilds/1/channels"]);
    });

    it("handles response", async () => {
      const testChannelResp = (id: string): any => ({
        id: id,
        name: "testChannelName",
        type: 0,
      });

      const response: any[] = [testChannelResp("1")];
      const expected: Channel[] = [testChannel("1")];
      const fetch = jest.fn(() => Promise.resolve(response));
      const fetcher = new DiscordFetcher(fetch, defaultOptions());
      const data = await fetcher.channels("0");
      expect(data).toEqual(expected);
    });
  });

  describe("fetch members", () => {
    const testMember = (userId: string): any => ({
      user: {
        id: userId,
        username: "username",
        discriminator: "disc",
        bot: true,
      },
      nick: "nickname",
    });

    const options = () => ({
      membersLimit: 2,
      messagesLimit: 100,
      reactionsLimit: 100,
    });

    it("passes correct endpoint", async () => {
      const fetch = jest.fn(() => Promise.resolve([]));
      const fetcher = new DiscordFetcher(fetch, options());
      await fetcher.members("1", "0");
      expect(fetch.mock.calls[0]).toEqual([
        "/guilds/1/members?after=0&limit=2",
      ]);
    });

    it("handles response", async () => {
      const response: GuildMember[] = [testMember("1")];
      const fetch = jest.fn(() => Promise.resolve(response));
      const fetcher = new DiscordFetcher(fetch, options());
      const {results} = await fetcher.members("1", "0");
      expect(results).toEqual(response);
    });

    it("returns correct endCursor", async () => {
      const response: any[] = [testMember("1"), testMember("2")];
      const fetch = jest.fn(() => Promise.resolve(response));
      const fetcher = new DiscordFetcher(fetch, options());
      const {endCursor} = (await fetcher.members("1", "0")).pageInfo;
      expect(endCursor).toEqual("2");
    });

    describe("next page", () => {
      it("next page = true", async () => {
        const response: any[] = [testMember("1")];
        const fetch = jest.fn(() => Promise.resolve(response));
        const fetcher = new DiscordFetcher(fetch, {
          membersLimit: 1,
          messagesLimit: 100,
          reactionsLimit: 100,
        });
        const {hasNextPage} = (await fetcher.members("1", "0")).pageInfo;
        expect(hasNextPage).toBe(true);
      });

      it("next page = false", async () => {
        const response: any[] = [testMember("1")];
        const fetch = jest.fn(() => Promise.resolve(response));
        const fetcher = new DiscordFetcher(fetch, {
          membersLimit: 2,
          messagesLimit: 100,
          reactionsLimit: 100,
        });
        const {hasNextPage} = (await fetcher.members("1", "0")).pageInfo;
        expect(hasNextPage).toBe(false);
      });
    });
  });

  describe("fetch reactions", () => {
    const emoji: Emoji = {id: "1", name: "emojiname"};

    const options = () => ({
      membersLimit: 100,
      messagesLimit: 100,
      reactionsLimit: 2,
    });

    it("passes correct endpoint", async () => {
      const fetch = jest.fn(() => Promise.resolve([]));
      const fetcher = new DiscordFetcher(fetch, options());
      await fetcher.reactions("1", "2", emoji, "0");
      expect(fetch.mock.calls[0]).toEqual([
        `/channels/1/messages/2/reactions/emojiname:1?after=0&limit=2`,
      ]);
    });

    it("handles response", async () => {
      // response object from server, prior to type transformation
      const response: any[] = [{id: "123", emoji}];
      const fetch = jest.fn(() => Promise.resolve(response));
      const fetcher = new DiscordFetcher(fetch, options());
      const {results} = await fetcher.reactions("3", "2", emoji, "0");
      const expected: Reaction[] = [
        {emoji, channelId: "3", messageId: "2", authorId: "123"},
      ];
      expect(results).toEqual(expected);
    });

    it("returns correct endCursor", async () => {
      const response: any[] = [
        {id: "1", emoji},
        {id: "2", emoji},
      ];
      const fetch = jest.fn(() => Promise.resolve(response));
      const fetcher = new DiscordFetcher(fetch, options());
      const {endCursor} = (await fetcher.reactions("1", "2", emoji, "0"))
        .pageInfo;
      expect(endCursor).toBe("2");
    });

    describe("next page", () => {
      it("next page = true", async () => {
        const response: any[] = [{id: 1, emoji}];
        const fetch = jest.fn(() => Promise.resolve(response));
        const fetcher = new DiscordFetcher(fetch, {
          membersLimit: 100,
          messagesLimit: 100,
          reactionsLimit: 1,
        });
        const {hasNextPage} = (await fetcher.reactions("1", "2", emoji, "0"))
          .pageInfo;
        expect(hasNextPage).toBe(true);
      });

      it("next page = false", async () => {
        const response: any[] = [{id: 1, emoji}];
        const fetch = jest.fn(() => Promise.resolve(response));
        const fetcher = new DiscordFetcher(fetch, {
          membersLimit: 100,
          messagesLimit: 100,
          reactionsLimit: 2,
        });
        const {hasNextPage} = (await fetcher.reactions("1", "2", emoji, "0"))
          .pageInfo;
        expect(hasNextPage).toBe(false);
      });
    });
  });

  describe("fetch messages", () => {
    const testMessage = (id: string): any => ({
      id: id,
      author: {id: "2"},
      timestamp: "2020-03-03T23:35:10.615000+00:00",
      content: "Just going to drop this here",
      reactions: [{emoji: {id: "1", name: "testemoji"}}],
      mentions: [{id: "4", username: "testuser"}],
    });

    const options = () => ({
      membersLimit: 100,
      messagesLimit: 2,
      reactionsLimit: 100,
    });

    it("passes correct endpoint", async () => {
      const fetch = jest.fn(() => Promise.resolve([]));
      const fetcher = new DiscordFetcher(fetch, options());
      await fetcher.messages("1", "0");
      expect(fetch.mock.calls[0]).toEqual([
        "/channels/1/messages?after=0&limit=2",
      ]);
    });

    it("handles response", async () => {
      const response: any[] = [testMessage("1")];

      const expected: Message[] = [
        {
          id: "1",
          channelId: "123",
          authorId: "2",
          timestampMs: Date.parse("2020-03-03T23:35:10.615000+00:00"),
          content: "Just going to drop this here",
          reactionEmoji: [{id: "1", name: "testemoji"}],
          nonUserAuthor: false,
          mentions: ["4"],
        },
      ];

      const fetch = jest.fn(() => Promise.resolve(response));
      const fetcher = new DiscordFetcher(fetch, options());
      const {results} = await fetcher.messages("123", "0");
      expect(results).toEqual(expected);
    });

    it("returns correct endCursor", async () => {
      const response: any[] = [testMessage("2"), testMessage("1")];
      const fetch = jest.fn(() => Promise.resolve(response));
      const fetcher = new DiscordFetcher(fetch, options());
      const {endCursor} = (await fetcher.messages("123", "0")).pageInfo;
      expect(endCursor).toBe("2");
    });

    describe("next page", () => {
      it("next page = true", async () => {
        const response: any[] = [testMessage("1")];
        const fetch = jest.fn(() => Promise.resolve(response));
        const fetcher = new DiscordFetcher(fetch, {
          membersLimit: 100,
          messagesLimit: 1,
          reactionsLimit: 2,
        });
        const {hasNextPage} = (await fetcher.messages("123", "0")).pageInfo;
        expect(hasNextPage).toBe(true);
      });

      it("next page = false", async () => {
        const response: any[] = [testMessage("1")];
        const fetch = jest.fn(() => Promise.resolve(response));
        const fetcher = new DiscordFetcher(fetch, {
          membersLimit: 100,
          messagesLimit: 2,
          reactionsLimit: 2,
        });
        const {hasNextPage} = (await fetcher.messages("123", "0")).pageInfo;
        expect(hasNextPage).toBe(false);
      });
    });
  });
});
