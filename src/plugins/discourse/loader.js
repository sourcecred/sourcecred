// @flow

import base64url from "base64url";
import {TaskReporter} from "../../util/taskReporter";
import {type CacheProvider} from "../../backend/cache";
import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type MirrorOptions, Mirror} from "./mirror";
import {SqliteMirrorRepository} from "./mirrorRepository";
import {declaration} from "./declaration";
import {Fetcher} from "./fetch";

export type DiscourseServer = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
|};

export interface Loader {
  declaration(): PluginDeclaration;
  updateMirror(
    server: DiscourseServer,
    cache: CacheProvider,
    reporter: TaskReporter
  ): Promise<void>;
}

export default ({
  declaration: () => declaration,
  updateMirror,
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

async function repository(
  cache: CacheProvider,
  serverUrl: string
): Promise<SqliteMirrorRepository> {
  // TODO: should replace base64url with hex, to be case insensitive.
  const db = await cache.database(base64url.encode(serverUrl));
  return new SqliteMirrorRepository(db, serverUrl);
}
