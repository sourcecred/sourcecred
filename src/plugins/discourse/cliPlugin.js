// @flow

import Database from "better-sqlite3";
import fs from "fs-extra";
import {join as pathJoin} from "path";

import type {
  CliPlugin,
  PluginDirectoryContext,
  AliasResolver,
} from "../../cli/cliPlugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {ReferenceDetector} from "../../core/references/referenceDetector";
import type {WeightedGraph} from "../../core/weightedGraph";
import {createGraph} from "./createGraph";
import {declaration} from "./declaration";
import {userAddress} from "./address";
import {parseConfig, type DiscourseConfig} from "./config";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {Fetcher} from "./fetch";
import {Mirror} from "./mirror";
import {DiscourseReferenceDetector} from "./referenceDetector";
import {type TaskReporter} from "../../util/taskReporter";

async function loadConfig(
  dirContext: PluginDirectoryContext
): Promise<DiscourseConfig> {
  const dirname = dirContext.configDirectory();
  const path = pathJoin(dirname, "config.json");
  const contents = await fs.readFile(path);
  return Promise.resolve(parseConfig(JSON.parse(contents)));
}

async function repository(
  ctx: PluginDirectoryContext,
  serverUrl: string
): Promise<SqliteMirrorRepository> {
  const path = pathJoin(ctx.cacheDirectory(), "discourseMirror.db");
  const db = await new Database(path);
  return new SqliteMirrorRepository(db, serverUrl);
}

export class DiscourseCliPlugin implements CliPlugin {
  declaration(): PluginDeclaration {
    return declaration;
  }

  async load(
    ctx: PluginDirectoryContext,
    reporter: TaskReporter
  ): Promise<void> {
    const {serverUrl, mirrorOptions} = await loadConfig(ctx);
    const repo = await repository(ctx, serverUrl);
    const fetcher = new Fetcher({serverUrl});
    const mirror = new Mirror(repo, fetcher, serverUrl, mirrorOptions);
    await mirror.update(reporter);
  }

  async graph(
    ctx: PluginDirectoryContext,
    rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    const _ = rd; // TODO(#1808): not yet used
    const config = await loadConfig(ctx);
    const repo = await repository(ctx, config.serverUrl);
    const graph = createGraph(config.serverUrl, repo);
    const weights = weightsForDeclaration(declaration);
    return {graph, weights};
  }

  async referenceDetector(
    ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    const config = await loadConfig(ctx);
    const repo = await repository(ctx, config.serverUrl);
    return new DiscourseReferenceDetector(repo);
  }

  async aliasResolver(ctx: PluginDirectoryContext): Promise<AliasResolver> {
    const {serverUrl} = await loadConfig(ctx);
    return (username) => userAddress(serverUrl, username);
  }
}
