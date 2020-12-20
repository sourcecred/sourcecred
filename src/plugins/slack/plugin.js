//@flow

import Database from "better-sqlite3";

import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {parser, type SlackConfig} from "./config";
import {declaration} from "./declaration";
import {join as pathJoin} from "path";
import {type TaskReporter} from "../../util/taskReporter";
import {Fetcher} from "./fetch";
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
import {loadJson} from "../../util/disk";
import {createIdentities} from "./createIdentities";
import type {IdentityProposal} from "../../core/ledger/identityProposal";

// Load config from root of directory
async function loadConfig(
  dirContext: PluginDirectoryContext
): Promise<SlackConfig> {
  const dirname = dirContext.configDirectory();
  const path = pathJoin(dirname, "config.json");
  return loadJson(path, parser);
}

export class SlackPlugin implements Plugin {
  id: PluginId = pluginIdFromString("sourcecred/slack");
  
  declaration(): PluginDeclaration {
    return declaration;
  }
  
  async load(
    ctx: PluginDirectoryContext,
    reporter: TaskReporter
  ): Promise<void> {
    const {token, name} = await loadConfig(ctx);
    const fetcher = new Fetcher(token);
    const repo = await repository(ctx);
    const mirror = new Mirror(repo, fetcher, token, name);
    await mirror.update(reporter);
  }
  
  async graph(
    ctx: PluginDirectoryContext,
    rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    const _ = rd;
    const {token, weights} = await loadConfig(ctx);
    const repo = await repository(ctx);

    const weightedGraph = await createGraph(token, repo, weights);

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
    // @todo: Implement Slack reference detection
    // (HIGH priority bc ppl hardlink to Slack messages)
    return {addressFromUrl: () => undefined};
  }
  
  async identities(
    ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    const repo = await repository(ctx);
    return createIdentities(repo);
  }
  
}

async function repository(
  ctx: PluginDirectoryContext
): Promise<SqliteMirrorRepository> {
  const path = pathJoin(ctx.cacheDirectory(), "slackMirror.db");
  const db = await new Database(path);
  return new SqliteMirrorRepository(db);
}

