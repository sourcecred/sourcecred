// @flow

import {snapshotFetcher} from "./mockSnapshotFetcher";

describe("plugins/discord/fetcher", () => {
  describe("snapshot testing", () => {
    const guildId = "678348980639498428";
    const channelId = "678394406507905129";
    const messageId = "678394436757094410";
    const emoji = {id: "678399364418502669", name: "sourcecred"};

    it("loads guilds", async () => {
      expect(await snapshotFetcher().guilds()).toMatchSnapshot();
    });
    it("loads channels", async () => {
      expect(await snapshotFetcher().channels(guildId)).toMatchSnapshot();
    });
    it("loads emojis", async () => {
      expect(await snapshotFetcher().emojis(guildId)).toMatchSnapshot();
    });
    it("loads roles", async () => {
      expect(await snapshotFetcher().roles(guildId)).toMatchSnapshot();
    });
    it("loads members", async () => {
      expect(await snapshotFetcher().members(guildId)).toMatchSnapshot();
    });
    it("loads messages", async () => {
      expect(
        await snapshotFetcher().messages(channelId, "0", 10)
      ).toMatchSnapshot();
      expect(
        await snapshotFetcher().messages(channelId, "678394455849566208", 10)
      ).toMatchSnapshot();
    });
    it("loads reactions", async () => {
      expect(
        await snapshotFetcher().reactions(channelId, messageId, emoji)
      ).toMatchSnapshot();
    });
  });
});
