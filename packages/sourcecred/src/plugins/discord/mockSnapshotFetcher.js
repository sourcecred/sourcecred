// @flow

import path from "path";
import fs from "fs-extra";
import {Fetcher} from "./fetcher";
import {createHash} from "crypto";

async function snapshotFetch(url: string | Request | URL): Promise<Response> {
  const snapshotDir = "src/plugins/discord/snapshots";
  const shasum = createHash("sha256");
  shasum.update(Buffer.from(((url: any): string), "utf8"));
  const filename = shasum.digest("hex");
  const file = path.join(snapshotDir, filename);
  if (await fs.exists(file)) {
    const contents = await fs.readFile(file);
    return new Response(contents, {status: 200});
  } else {
    throw new Error(`couldn't load snapshot for ${file} (${String(url)})`);
  }
}

export const snapshotFetcher = (): Fetcher =>
  new Fetcher({
    fetch: snapshotFetch,
    token: "mock-token",
  });
