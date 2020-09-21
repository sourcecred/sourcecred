// @flow

import Database from "better-sqlite3";
import {join as pathJoin} from "path";

import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {ReferenceDetector} from "../../core/references";
import type {WeightedGraph} from "../../core/weightedGraph";
import {createGraph} from "./createGraph";
import {declaration} from "./declaration";
import {parser, type DiscourseConfig} from "./config";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {Fetcher} from "./fetch";
import {Mirror} from "./mirror";
import {DiscourseReferenceDetector} from "./referenceDetector";
import {TaskManager} from "../../util/taskManager";

import {
  type PluginId,
  fromString as pluginIdFromString,
} from "../../api/pluginId";
import {loadJson} from "../../util/disk";
import {createIdentities} from "./createIdentities";
import type {IdentityProposal} from "../../core/ledger/identityProposal";

async function loadConfig(
  dirContext: PluginDirectoryContext
): Promise<DiscourseConfig> {
  const dirname = dirContext.configDirectory();
  const path = pathJoin(dirname, "config.json");
  return loadJson(path, parser);
}

async function repository(
  ctx: PluginDirectoryContext,
  serverUrl: string
): Promise<SqliteMirrorRepository> {
  const path = pathJoin(ctx.cacheDirectory(), "discourseMirror.db");
  const db = await new Database(path);
  return new SqliteMirrorRepository(db, serverUrl);
}

export class DiscoursePlugin implements Plugin {
  id: PluginId = pluginIdFromString("sourcecred/discourse");

  declaration(): PluginDeclaration {
    return declaration;
  }

  async load(ctx: PluginDirectoryContext, manager: TaskManager): Promise<void> {
    const {serverUrl, mirrorOptions} = await loadConfig(ctx);
    const repo = await repository(ctx, serverUrl);
    const fetcher = new Fetcher({serverUrl});
    const mirror = new Mirror(repo, fetcher, serverUrl, mirrorOptions);
    await mirror.update(manager);
  }

  async graph(
    ctx: PluginDirectoryContext,
    rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    const _ = rd; // TODO(#1808): not yet used
    const config = await loadConfig(ctx);
    const repo = await repository(ctx, config.serverUrl);
    return createGraph(config.serverUrl, repo);
  }

  async referenceDetector(
    ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    const config = await loadConfig(ctx);
    const repo = await repository(ctx, config.serverUrl);
    return new DiscourseReferenceDetector(repo);
  }

  async identities(
    ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    const config = await loadConfig(ctx);
    const repo = await repository(ctx, config.serverUrl);
    return createIdentities(config.serverUrl, repo);
  }
}
