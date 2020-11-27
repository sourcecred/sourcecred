/**
 * @jest-environment node
 */
// @flow

import Database from "better-sqlite3";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {token} from "./testUtils/data.json";
import {Fetcher} from "./fetch";
import {Mirror} from "./mirror";

describe("plugins/experimental-discord/mirror", () => {
  jest.setTimeout(30000); // 30 seconds timeout (takes longer due to pagination)
  describe("smoke test", () => {
    const repo = new SqliteMirrorRepository(
      new Database(":memory:")
    );
    const fetcher = new Fetcher(token); 
    const name = "My Community";
    const mirror = new Mirror(repo, fetcher, token, name);

    it("adds members", async () => {
      await mirror.addMembers();
      const stmt = repo._db.prepare(
        "select * from members"
      );
      const get = stmt.get();
      console.log ("members:", get);
    });

    it ("adds channels", async () => {
      await mirror.addChannels();
      const stmt = repo._db.prepare(
        "select * from channels"
      );
      const get = stmt.get();
      console.log ("channels:", get);
    });

    it ("adds messages", async () => {
      const channel = { id: 'C01CPGVGXSB', name: 'testing-out-things' };
      await mirror.addMessages(channel);
      const stmt = repo._db.prepare(
        "select * from messages"
      );
      const get = stmt.all();
      console.log ("messages:", get);
    });
  });
});
