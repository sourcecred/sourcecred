// @flow

import Database from "better-sqlite3";
import base64url from "base64url";
import {Fetcher, type DiscourseFetchOptions} from "./fetch";
import {Mirror} from "./mirror";
import {createGraph} from "./createGraph";
import {TaskReporter} from "../../util/taskReporter";
import {Graph} from "../../core/graph";
import path from "path";

export type {DiscourseFetchOptions} from "./fetch";

export type Options = {|
  +fetchOptions: DiscourseFetchOptions,
  +cacheDirectory: string,
|};

export async function loadDiscourse(
  options: Options,
  reporter: TaskReporter
): Promise<Graph> {
  const filename = base64url.encode(options.fetchOptions.serverUrl) + ".db";
  const db = new Database(path.join(options.cacheDirectory, filename));
  const fetcher = new Fetcher(options.fetchOptions);
  const mirror = new Mirror(db, fetcher, options.fetchOptions.serverUrl);
  await mirror.update(reporter);
  const graph = createGraph(options.fetchOptions.serverUrl, mirror);
  return graph;
}
