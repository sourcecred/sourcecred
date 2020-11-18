// @flow
import {join as pathJoin} from "path";
import fs from "fs";
import Client from "pg-native";

import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import type {ReferenceDetector} from "../../core/references";
import {type TaskReporter} from "../../util/taskReporter";
import type {WeightedGraph} from "../../core/weightedGraph";
import type {IdentityProposal} from "../../core/ledger/identityProposal";
import {
  type PluginId,
  fromString as pluginIdFromString,
} from "../../api/pluginId";
import {loadJson} from "../../util/disk";

import {parser, type GitcoinConfig} from "./config";
import {declaration} from "./declaration";
import {createGraph} from "./createGraph";
import {PostgresMirrorRepository} from "./mirrorRepository";
import {createIdentities} from "./createIdentities";

async function loadConfig(
  dirContext: PluginDirectoryContext
): Promise<GitcoinConfig> {
  const dirname = dirContext.configDirectory();
  const path = pathJoin(dirname, "config.json");
  return loadJson(path, parser);
}

async function repository(
  ctx: PluginDirectoryContext,
  connectionString: string
): Promise<PostgresMirrorRepository> {
  const db = new Client();
  db.connectSync(connectionString);
  return new PostgresMirrorRepository(db);
}

export class GitcoinPlugin implements Plugin {
  id: PluginId = pluginIdFromString("sourcecred/gitcoin");

  declaration(): PluginDeclaration {
    return declaration;
  }

  async load(
    ctx: PluginDirectoryContext,
    reporter: TaskReporter
  ): Promise<void> {
    const configDir = ctx.configDirectory();
    const path = pathJoin(configDir, "config.json");
    const pgDatabaseUrl = process.env.GITCOIN_POSTGRES_URL;
    const gitcoinHost = process.env.GITCOIN_HOST;
    const userWhitelist = process.env.GITCOIN_USER_WHITELIST ? JSON.parse(process.env.GITCOIN_USER_WHITELIST) : null;
    const task = `gitcoin: config file generating`;

    if (fs.existsSync(path)) {
      return;
    }

    reporter.start(task);

    if (!pgDatabaseUrl) {
      throw new Error("missing GITCOIN_POSTGRES_URL environmental variable");
    }

    if (!gitcoinHost) {
      throw new Error("missing GITCOIN_HOST environmental variable");
    }

    if (!userWhitelist) {
      throw new Error("missing GITCOIN_USER_WHITELIST environmental variable");
    }

    const config = {
      pgDatabaseUrl,
      gitcoinHost,
      userWhitelist,
    };

    fs.writeFileSync(path, JSON.stringify(config));

    reporter.finish(task);
  }

  async graph(
    ctx: PluginDirectoryContext,
    rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    const _ = rd;
    const {pgDatabaseUrl, gitcoinHost, userWhitelist} = await loadConfig(ctx);
    const repo = await repository(ctx, pgDatabaseUrl);
    const weightedGraph = await createGraph(gitcoinHost, repo, userWhitelist);

    return weightedGraph;
  }

  async referenceDetector(
    _unused_ctx: PluginDirectoryContext,
    _unused_reporter: TaskReporter
  ): Promise<ReferenceDetector> {
    //TODO
    return {addressFromUrl: () => undefined};
  }

  async identities(
    ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    const {pgDatabaseUrl, gitcoinHost} = await loadConfig(ctx);
    const repo = await repository(ctx, pgDatabaseUrl);
    return createIdentities(repo, gitcoinHost);
  }
}
