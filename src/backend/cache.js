//@flow

import Database from "better-sqlite3";

/**
 * A cache abstraction which plugins can use to store mirroring data in.
 */
export interface CacheProvider {
  /**
   * Opens a new Database handle.
   * Given the same `id`, an existing Database from the cache *may* be provided.
   *
   * Make sure the `id` you're using is both _deterministic_ and doesn't
   * conflict with other plugins.
   */
  database(id: string): Promise<Database>;
}
