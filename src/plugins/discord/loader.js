// @flow

import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightedGraph} from "../../core/weightedGraph";
import {TaskReporter} from "../../util/taskReporter";
import {type CacheProvider} from "../../backend/cache";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {createGraph as _createGraph} from "./createGraph";
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
  createGraph(
    guild: Model.Snowflake,
    cache: CacheProvider
  ): Promise<WeightedGraph>;
}

export default ({
  declaration: () => declaration,
  updateMirror,
  createGraph,
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

export async function createGraph(
  guild: Model.Snowflake,
  cache: CacheProvider
): Promise<WeightedGraph> {
  const repo = await repository(cache, guild);
  return await _createGraph(guild, repo);
}

async function repository(
  cache: CacheProvider,
  guild: Model.Snowflake
): Promise<SqliteMirrorRepository> {
  // TODO: should replace base64url with hex, to be case insensitive.
  const db = await cache.database(`discord_${guild}`);
  return new SqliteMirrorRepository(db, guild);
}
