// @flow

import base64url from "base64url";
import path from "path";
import fs from "fs-extra";
import Database from "better-sqlite3";
import {DISCORD_SERVER, fetchDiscordServer, buildDiscordFetch} from "./fetch";
import {SqliteMirror} from "./sqliteMirror";

const TEST_GUILD_ID = "678348980639498428";

async function fetchSnapshot(endpoint: string): Promise<any> {
  const snapshotDir = "src/plugins/discord/snapshots";
  const url = `${DISCORD_SERVER}${endpoint}`;
  const filename = base64url(url);
  const file = path.join(snapshotDir, filename);
  if (await fs.exists(file)) {
    const contents = await fs.readFile(file);
    const json = JSON.parse(contents);
    return json;
  } else {
    return [];
  }
}

describe("plugins/discord/fetcher", () => {
  describe("passes snapshot tests", () => {
    const fetch = async () => {
      const fetchOptions = {
        membersLimit: 10,
        messagesLimit: 5,
        reactionsLimit: 5,
      };
      const db = new Database(":memory:");
      const mirror = new SqliteMirror(db, TEST_GUILD_ID);
      await fetchDiscordServer(
        TEST_GUILD_ID,
        fetchSnapshot,
        fetchOptions,
        mirror
      );
      return mirror;
    };

    it("fetches members", async () => {
      const mirror = await fetch();
      const members = mirror.members();
      expect(members.length).toBe(6);
      expect(members).toMatchSnapshot();
    });
    it("fetches channels", async () => {
      const mirror = await fetch();
      const channels = mirror.channels();
      expect(channels.length).toBe(6);
      expect(channels).toMatchSnapshot();
    });
    it("fetches messages", async () => {
      const mirror = await fetch();
      const channelId = "678394406507905129";
      const messages = mirror.messages(channelId);
      expect(messages.length).toBe(15);
      expect(messages).toMatchSnapshot();
    });
    it("fetches emojis", async () => {
      const channelId = "678394406507905129";
      const messageId = "678394436757094410";
      const mirror = await fetch();
      const reactions = mirror.reactions(channelId, messageId);
      expect(reactions.length).toBe(2);
      expect(reactions).toMatchSnapshot();
    });
  });
  describe("network error handling", () => {
    const makeFetch = (params) => {
      return jest
        .fn()
        .mockImplementation(() => Promise.resolve(new Response("", params)));
    };
    it("handles errors", async () => {
      const fetch = makeFetch({status: 404});
      const fakeFetch = () => buildDiscordFetch(fetch, "");
      expect(fakeFetch()).rejects.toThrow("404");
    });
    it("handles 50001 code", async () => {
      const fetch = makeFetch({code: 50001});
      const fakeFetch = () => buildDiscordFetch(fetch, "");
      expect(fakeFetch()).rejects.toThrow("50001");
    });
  });
});
