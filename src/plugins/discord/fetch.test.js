// @flow

import {snapshotFetcher} from "./mockSnapshotFetcher";

describe("plugins/discord/fetch", () => {
  describe("snapshot testing", () => {
    it("loads the snapshots", async () => {
      expect(await snapshotFetcher().guilds()).toMatchSnapshot();
    });
  });
});
