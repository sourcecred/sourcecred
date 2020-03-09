// @flow

import stringify from "json-stable-stringify";
import dedent from "../../util/dedent";

// The version should be bumped any time the database schema is changed,
// so that the cache will be properly invalidated.
export const SCHEMA_VERSION = "discourse_mirror_v6";

type Upgrade = {|
  +target: string,
  +changes: $ReadOnlyArray<string>,
|};

type VersionConfig = {|
  +version: string,
  +serverUrl: string,
|};

export const stringifyConfig = (c: VersionConfig): string => stringify(c);
export const parseConfig = (json: string): VersionConfig => JSON.parse(json);

// Queries to upgrade from a previous version to the target version.
export const upgrades: {[current: string]: Upgrade} = {
  discourse_mirror_v5: {
    target: "discourse_mirror_v6",
    changes: [
      dedent`\
        CREATE TABLE sync_heads (
          key TEXT PRIMARY KEY,
          timestamp_ms INTEGER NOT NULL
        )`,
    ],
  },
};

// Queries to build a "greenfield" instance of that version.
export const createVersion: {[target: string]: () => $ReadOnlyArray<string>} = {
  discourse_mirror_v6() {
    return [
      ...this.discourse_mirror_v5(),
      ...upgrades.discourse_mirror_v5.changes,
    ];
  },
  discourse_mirror_v5() {
    return [
      ...this.meta(),
      "CREATE TABLE users (username TEXT PRIMARY KEY)",
      dedent`\
        CREATE TABLE topics (
          id INTEGER PRIMARY KEY,
          category_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          timestamp_ms INTEGER NOT NULL,
          bumped_ms INTEGER NOT NULL,
          author_username TEXT NOT NULL,
          FOREIGN KEY(author_username) REFERENCES users(username)
        )`,
      dedent`\
        CREATE TABLE posts (
          id INTEGER PRIMARY KEY,
          timestamp_ms INTEGER NOT NULL,
          author_username TEXT NOT NULL,
          topic_id INTEGER NOT NULL,
          index_within_topic INTEGER NOT NULL,
          reply_to_post_index INTEGER,
          cooked TEXT NOT NULL,
          FOREIGN KEY(topic_id) REFERENCES topics(id),
          FOREIGN KEY(author_username) REFERENCES users(username)
        )`,
      dedent`\
        CREATE TABLE likes (
          post_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          timestamp_ms INTEGER NOT NULL,
          CONSTRAINT username_post PRIMARY KEY (post_id, username),
          FOREIGN KEY(post_id) REFERENCES posts(id),
          FOREIGN KEY(username) REFERENCES users(username)
        )`,
    ];
  },
  meta() {
    return [
      dedent`\
        CREATE TABLE IF NOT EXISTS meta (
          zero INTEGER PRIMARY KEY,
          config TEXT NOT NULL
        )`,
    ];
  },
};
