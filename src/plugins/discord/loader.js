// @flow

import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightedGraph} from "../../core/weightedGraph";
import {TaskReporter} from "../../util/taskReporter";
import {type CacheProvider} from "../../backend/cache";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {createGraph as _createGraph} from "./createGraph";
import {type ProjectOptions} from "./params";
import {declaration} from "./declaration";
import * as Model from "./models";
import {Fetcher} from "./fetcher";
import {Mirror} from "./mirror";

export interface Loader {
  declaration(): PluginDeclaration;
  updateMirror: typeof updateMirror;
  createGraph: typeof createGraph;
}

export default ({
  declaration: () => declaration,
  updateMirror,
  createGraph,
}: Loader);

export async function updateMirror(
  {guildId}: ProjectOptions,
  token: Model.BotToken,
  cache: CacheProvider,
  reporter: TaskReporter
): Promise<void> {
  const repo = await repository(cache, guildId);
  const fetcher = new Fetcher({token});
  const mirror = new Mirror(repo, fetcher, guildId);
  await mirror.update(reporter);
}

export async function createGraph(
  {guildId, reactionWeights}: ProjectOptions,
  cache: CacheProvider
): Promise<WeightedGraph> {
  const repo = await repository(cache, guildId);
  const declarationWeights = weightsForDeclaration(declaration);
  return await _createGraph(guildId, repo, declarationWeights, reactionWeights);
}

async function repository(
  cache: CacheProvider,
  guild: Model.Snowflake
): Promise<SqliteMirrorRepository> {
  // TODO: should replace base64url with hex, to be case insensitive.
  const db = await cache.database(`discord_${guild}`);
  return new SqliteMirrorRepository(db, guild);
}
