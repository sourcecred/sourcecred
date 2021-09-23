// @flow

import Database from "better-sqlite3";
import {snapshotFetcher} from "./mockSnapshotFetcher";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {Mirror} from "./mirror";

describe("plugins/discord/mirror", () => {
  const config = {
    guildId: "453243919774253079",
    propsChannels: [],
    weights: {
      emojiWeights: {
        weights: {},
        applyAveraging: true,
        defaultWeight: 2,
      },
      channelWeights: {
        defaultWeight: 1,
        weights: {
          "759191073943191613": 2,
          "678348980849213472": 1,
        },
      },
      roleWeights: {
        defaultWeight: 0,
        weights: {},
      },
    },
    includeNsfwChannels: true,
  };

  describe("smoke test", () => {
    config.guildId = "678348980639498428";

    it("should omit zero-weighted channels", async () => {
      config.weights.channelWeights.weights["678348980849213472"] = 0;
      // Given
      const repo = new SqliteMirrorRepository(
        new Database(":memory:"),
        config.guildId
      );
      const api = snapshotFetcher();

      // When
      const mirror = new Mirror(repo, api, config);
      await mirror.addMembers();
      await mirror.addTextChannels();
      expect(
        repo.channels().some((channel) => channel.id === "678348980849213472")
      ).toBe(false);
    });

    it("should work when NSFW enabled", async () => {
      config.includeNsfwChannels = true;
      // Given
      const repo = new SqliteMirrorRepository(
        new Database(":memory:"),
        config.guildId
      );
      const api = snapshotFetcher();

      // When
      const mirror = new Mirror(repo, api, config);
      await mirror.addMembers();
      await mirror.addTextChannels();
      expect(
        repo.channels().some((channel) => channel.name.includes("nsfw"))
      ).toBe(true);
    });

    it("should work when NSFW disabled", async () => {
      config.includeNsfwChannels = false;
      // Given
      const repo = new SqliteMirrorRepository(
        new Database(":memory:"),
        config.guildId
      );
      const api = snapshotFetcher();

      // When
      const mirror = new Mirror(repo, api, config);
      await mirror.addMembers();
      await mirror.addTextChannels();
      expect(
        repo.channels().every((channel) => !channel.name.includes("nsfw"))
      ).toBe(true);
    });
  });
});
