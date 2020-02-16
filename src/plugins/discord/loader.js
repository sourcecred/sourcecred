// @flow

import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {TaskReporter} from "../../util/taskReporter";
import {type CacheProvider} from "../../backend/cache";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {declaration} from "./declaration";
import * as Model from "./models";
import {Fetcher} from "./fetcher";
import {Mirror} from "./mirror";

export interface Loader {
  declaration(): PluginDeclaration;
  updateMirror(
    guild: Model.Snowflake,
    token: Model.BotToken,
    cache: CacheProvider,
    reporter: TaskReporter
  ): Promise<void>;
}

export default ({
  declaration: () => declaration,
  updateMirror,
}: Loader);

export async function updateMirror(
  guild: Model.Snowflake,
  token: Model.BotToken,
  cache: CacheProvider,
  reporter: TaskReporter
): Promise<void> {
  const repo = await repository(cache, guild);
  const fetcher = new Fetcher({token});
  const mirror = new Mirror(repo, fetcher, guild);
  await mirror.update(reporter);
}

async function repository(
  cache: CacheProvider,
  guild: Model.Snowflake
): Promise<SqliteMirrorRepository> {
  // TODO: should replace base64url with hex, to be case insensitive.
  const db = await cache.database(`discord_${guild}`);
  return new SqliteMirrorRepository(db, guild);
}
