// @flow

import Database from "better-sqlite3";
import {snapshotFetcher} from "./mockSnapshotFetcher";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {Mirror} from "./mirror";

describe("plugins/discord/mirror", () => {
  describe("smoke test", () => {
    const guildId = "678348980639498428";
    const includeNsfwChannels = true;
    // const channelId = "678394406507905129";

    it("should print", async () => {
      // Given
      const repo = new SqliteMirrorRepository(
        new Database(":memory:"),
        guildId
      );
      const api = snapshotFetcher();

      // When
      const mirror = new Mirror(repo, api, guildId, includeNsfwChannels);
      await mirror.addMembers();
      await mirror.addTextChannels();
      // await mirror.addMessages(channelId, 10);
    });
  });
});
