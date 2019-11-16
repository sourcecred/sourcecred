// @flow

import Database from "better-sqlite3";
import base64url from "base64url";
import {Fetcher} from "./fetch";
import {SqliteMirrorRepository, type ReadRepository} from "./mirrorRepository";
import {Mirror, type MirrorOptions} from "./mirror";
import {createGraph} from "./createGraph";
import {TaskReporter} from "../../util/taskReporter";
import {Graph} from "../../core/graph";
import path from "path";

export type DiscourseServer = {|
  +serverUrl: string,
  +mirrorOptions?: $Shape<MirrorOptions>,
|};

export type Options = {|
  +discourseServer: DiscourseServer,
  +cacheDirectory: string,
|};

export async function loadDiscourse(
  options: Options,
  reporter: TaskReporter
): Promise<Graph> {
  const {serverUrl, mirrorOptions} = options.discourseServer;
  const filename = base64url.encode(serverUrl) + ".db";
  const db = new Database(path.join(options.cacheDirectory, filename));
  const repo = new SqliteMirrorRepository(db, serverUrl);
  const fetcher = new Fetcher({serverUrl});
  const mirror = new Mirror(repo, fetcher, serverUrl, mirrorOptions);
  await mirror.update(reporter);
  return createGraph(serverUrl, (repo: ReadRepository));
}
