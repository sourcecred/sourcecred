// @flow

import Database from "better-sqlite3";
import {type Command} from "./command";
import {SqliteMirrorRepository} from "../plugins/discord/mirrorRepository";
import {Fetcher} from "../plugins/discord/fetcher";
import {Mirror} from "../plugins/discord/mirror";

function die(std, message) {
  std.err("fatal: " + message);
  std.err("fatal: run 'sourcecred help discord' for help");
  return 1;
}

const discord: Command = async (args, std) => {
  if (args.length !== 1) {
    return die(std, "Expected one positional argument (or --help).");
  }
  const [guildId] = args;

  const repo = new SqliteMirrorRepository(new Database(":memory:"), guildId);
  const api = new Fetcher({
    token: process.env.SOURCECRED_DISCORD_TOKEN || null,
  });

  const mirror = new Mirror(repo, api, guildId);
  mirror.load();
  return 0;
};

export default discord;
