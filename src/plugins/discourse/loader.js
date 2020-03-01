// @flow

import base64url from "base64url";
import {TaskReporter} from "../../util/taskReporter";
import {type CacheProvider} from "../../backend/cache";
import {type WeightedGraph} from "../../core/weightedGraph";
import {type ReferenceDetector} from "../../core/references";
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type DiscourseServer} from "./server";
import {Mirror} from "./mirror";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {weightsForDeclaration} from "../../analysis/pluginDeclaration";
import {DiscourseReferenceDetector} from "./referenceDetector";
import {createGraph as _createGraph} from "./createGraph";
import {declaration} from "./declaration";
import {Fetcher} from "./fetch";

export interface Loader {
  declaration(): PluginDeclaration;
  updateMirror(
    server: DiscourseServer,
    cache: CacheProvider,
    reporter: TaskReporter
  ): Promise<void>;
  referenceDetector(
    server: DiscourseServer,
    cache: CacheProvider
  ): Promise<ReferenceDetector>;
  createGraph(
    server: DiscourseServer,
    cache: CacheProvider
  ): Promise<WeightedGraph>;
}

export default ({
  declaration: () => declaration,
  updateMirror,
  referenceDetector,
  createGraph,
}: Loader);

export async function updateMirror(
  server: DiscourseServer,
  cache: CacheProvider,
  reporter: TaskReporter
): Promise<void> {
  const {serverUrl, mirrorOptions} = server;
  const repo = await repository(cache, serverUrl);
  const fetcher = new Fetcher({serverUrl});
  const mirror = new Mirror(repo, fetcher, serverUrl, mirrorOptions);
  await mirror.update(reporter);
}

export async function referenceDetector(
  {serverUrl}: DiscourseServer,
  cache: CacheProvider
): Promise<ReferenceDetector> {
  const repo = await repository(cache, serverUrl);
  return new DiscourseReferenceDetector(repo);
}

export async function createGraph(
  {serverUrl}: DiscourseServer,
  cache: CacheProvider
): Promise<WeightedGraph> {
  const repo = await repository(cache, serverUrl);
  const graph = _createGraph(serverUrl, repo);
  const weights = weightsForDeclaration(declaration);
  return {graph, weights};
}

async function repository(
  cache: CacheProvider,
  serverUrl: string
): Promise<SqliteMirrorRepository> {
  // TODO: should replace base64url with hex, to be case insensitive.
  const db = await cache.database(base64url.encode(serverUrl));
  return new SqliteMirrorRepository(db, serverUrl);
}
