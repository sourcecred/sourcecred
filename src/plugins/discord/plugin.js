// @flow

import Database from "better-sqlite3";

import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {parser, type DiscordConfig, type DiscordToken} from "./config";
import {declaration} from "./declaration";
import {join as pathJoin} from "path";
import {type TaskReporter} from "../../util/taskReporter";
import {Fetcher} from "./fetcher";
import {Mirror} from "./mirror";
import type {ReferenceDetector} from "../../core/references";
import type {WeightedGraph} from "../../core/weightedGraph";
import {merge as mergeWeights} from "../../core/weights";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {createGraph} from "./createGraph";
import * as Model from "./models";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {
  type PluginId,
  fromString as pluginIdFromString,
} from "../../api/pluginId";
import {loadJson} from "../../util/storage";
import {DiskStorage} from "../../core/storage/disk";
import {createIdentities} from "./createIdentities";
import type {IdentityProposal} from "../../core/ledger/identityProposal";

async function loadConfig(
  dirContext: PluginDirectoryContext
): Promise<DiscordConfig> {
  const dirname = dirContext.configDirectory();
  const storage = new DiskStorage(dirname);
  return loadJson(storage, "config.json", parser);
}

const TOKEN_ENV_VAR_NAME = "SOURCECRED_DISCORD_TOKEN";

function getTokenFromEnv(): DiscordToken {
  const rawToken = process.env[TOKEN_ENV_VAR_NAME];
  if (rawToken == null) {
    throw new Error(`No Discord token provided: set ${TOKEN_ENV_VAR_NAME}`);
  }
  return rawToken;
}

export class DiscordPlugin implements Plugin {
  id: PluginId = pluginIdFromString("sourcecred/discord");

  declaration(): PluginDeclaration {
    return declaration;
  }

  async load(
    ctx: PluginDirectoryContext,
    reporter: TaskReporter
  ): Promise<void> {
    const {guildId} = await loadConfig(ctx);
    const token = getTokenFromEnv();
    const fetcher = new Fetcher({token});
    const repo = await repository(ctx, guildId);
    const mirror = new Mirror(repo, fetcher, guildId);
    await mirror.update(reporter);
  }

  async graph(
    ctx: PluginDirectoryContext,
    rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    const _ = rd; // TODO(#1808): not yet used
    const config = await loadConfig(ctx);
    const repo = await repository(ctx, config.guildId);

    const weightedGraph = await createGraph(config, repo);

    const declarationWeights = weightsForDeclaration(declaration);
    // Add in the type-level weights from the plugin spec
    const combinedWeights = mergeWeights([
      weightedGraph.weights,
      declarationWeights,
    ]);
    return {graph: weightedGraph.graph, weights: combinedWeights};
  }

  async referenceDetector(
    _unused_ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    // TODO: Implement Discord reference detection
    // (low priority bc ppl rarely hardlink to Discord messages)
    return {addressFromUrl: () => undefined};
  }

  async identities(
    ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    const {guildId} = await loadConfig(ctx);
    const repo = await repository(ctx, guildId);
    return createIdentities(repo);
  }
}

async function repository(
  ctx: PluginDirectoryContext,
  guild: Model.Snowflake
): Promise<SqliteMirrorRepository> {
  const path = pathJoin(ctx.cacheDirectory(), "discordMirror.db");
  const db = await new Database(path);
  return new SqliteMirrorRepository(db, guild);
}
