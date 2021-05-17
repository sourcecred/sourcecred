// @flow

import deepFreeze from "deep-freeze";
import base64url from "base64url";
import path from "path";
import fs from "fs-extra";
import {Fetcher, type DiscourseFetchOptions} from "./fetch";

export const options: DiscourseFetchOptions = deepFreeze({
  serverUrl: "https://sourcecred-test.discourse.group",
});

async function snapshotFetch(url: string | Request | URL): Promise<Response> {
  const snapshotDir = "src/plugins/discourse/snapshots";
  const filename = base64url(url);
  const file = path.join(snapshotDir, filename);
  if (await fs.exists(file)) {
    const contents = await fs.readFile(file);
    return new Response(contents, {status: 200});
  } else {
    throw new Error(`couldn't load snapshot for ${file}`);
  }
}
export const snapshotFetcher = (): Fetcher =>
  new Fetcher(options, snapshotFetch, 0);
