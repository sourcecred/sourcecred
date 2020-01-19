// @flow

import base64url from "base64url";
import {Fetcher} from "./fetch";
import {SqliteMirrorRepository, type ReadRepository} from "./mirrorRepository";
import {Mirror, type MirrorOptions} from "./mirror";
import {createGraph as _createGraph} from "./createGraph";
import {type CacheProvider} from "../../backend/cache";
import {TaskReporter} from "../../util/taskReporter";
import {Graph} from "../../core/graph";

export type DiscourseServer = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
|};

export interface DiscourseLoader {
  updateMirror(
    server: DiscourseServer,
    cache: CacheProvider,
    reporter: TaskReporter
  ): Promise<void>;

  createGraph(server: DiscourseServer, cache: CacheProvider): Promise<Graph>;
}

export const discourseLoader: DiscourseLoader = {updateMirror, createGraph};

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

export async function createGraph(
  server: DiscourseServer,
  cache: CacheProvider
): Promise<Graph> {
  const repo = await repository(cache, server.serverUrl);
  return _createGraph(server.serverUrl, (repo: ReadRepository));
}

async function repository(
  cache: CacheProvider,
  serverUrl: string
): Promise<SqliteMirrorRepository> {
  const db = await cache.database(base64url.encode(serverUrl));
  return new SqliteMirrorRepository(db, serverUrl);
}
