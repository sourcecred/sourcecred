// @flow

import Database from "better-sqlite3";

import type {CliPlugin, PluginDirectoryContext} from "../../cli2/cliPlugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {parseConfig, type DiscordConfig, type DiscordToken} from "./config";
import {declaration} from "./declaration";
import {join as pathJoin} from "path";
import fs from "fs-extra";
import {type TaskReporter} from "../../util/taskReporter";
import {Fetcher} from "./fetcher";
import {Mirror} from "./mirror";
import type {ReferenceDetector} from "../../core/references/referenceDetector";
import type {WeightedGraph} from "../../core/weightedGraph";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {createGraph} from "./createGraph";
import * as Model from "./models";
import {SqliteMirrorRepository} from "./mirrorRepository";

async function loadConfig(
  dirContext: PluginDirectoryContext
): Promise<DiscordConfig> {
  const dirname = dirContext.configDirectory();
  const path = pathJoin(dirname, "config.json");
  const contents = await fs.readFile(path);
  return Promise.resolve(parseConfig(JSON.parse(contents)));
}

const TOKEN_ENV_VAR_NAME = "SOURCECRED_DISCORD_TOKEN";

function getTokenFromEnv(): DiscordToken {
  const rawToken = process.env[TOKEN_ENV_VAR_NAME];
  if (rawToken == null) {
    throw new Error(`No Discord token provided: set ${TOKEN_ENV_VAR_NAME}`);
  }
  return rawToken;
}

export class DiscordCliPlugin implements CliPlugin {
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
    const {guildId, reactionWeights} = await loadConfig(ctx);
    const repo = await repository(ctx, guildId);
    const declarationWeights = weightsForDeclaration(declaration);
    return await createGraph(
      guildId,
      repo,
      declarationWeights,
      reactionWeights
    );
  }

  async referenceDetector(
    _unused_ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    // TODO: Implement Discord reference detection
    // (low priority bc ppl rarely hardlink to Discord messages)
    return {addressFromUrl: () => undefined};
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
