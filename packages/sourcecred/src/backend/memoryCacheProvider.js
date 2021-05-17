// @flow

import Database from "better-sqlite3";
import {type CacheProvider} from "./cache";

/**
 * An in-memory CacheProvider.
 *
 * Using the same ID's will produce the same cache, however data will be lost when
 * the process exits, or references to the MemoryCacheProvider are deleted.
 *
 * Useful for tests or less I/O intense commands which should run in isolation.
 */
export class MemoryCacheProvider implements CacheProvider {
  +_instances: Map<string, Database> = new Map();

  /**
   * Returns a Database handle associated with this `id`,
   * an existing Database from the cache *may* be provided.
   *
   * Note: the exact Database object may be shared within the process.
   */
  async database(id: string): Promise<Database> {
    let db = this._instances.get(id);
    if (!db) {
      db = new Database(":memory:");
      this._instances.set(id, db);
    }
    return db;
  }
}
