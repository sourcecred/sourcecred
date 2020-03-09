// @flow

import {type ServerUrl} from "./models";

/**
 * Creates a cache key that's unique and safe for filesystem use.
 */
export function cacheKey(serverUrl: ServerUrl): string {
  const url = new global.URL(serverUrl);
  // Remove trailing colon from protol.
  const protocol = url.protocol.replace(/:$/, "");
  const portSuffix = url.port ? `_${url.port}` : "";
  return `discourse_${protocol}_${url.hostname}${portSuffix}`.toLowerCase();
}
