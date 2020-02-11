// @flow

import type Database from "better-sqlite3";
import dedent from "../../util/dedent";

const VERSION = "discord_mirror_v1"

export class Mirror {
  
}

// If there are no messages in the db, the module
// will begin fetching at the latest message and
// retrieve messages in reverse chronological order
// until all messages are retrieved.
//
// If the db contains messages, the module retrives the earliest
// and latest timestamped messages. The module asks the api for
// all messages chronologicallly earlier than the earliest timestamped
// message in the db, and all messages chronologically later than
// the latest timestamped message.


//
// export class Mirror {
//   +_db: Database;
//
//   constructor(db: Database) {
//     if (db == null) throw new Error("db: " + String(db));
//     this._db = db
//     this._initialize();
//   }
//
//   _initialize() {
//     db.prepare(
//       dedent`\
//         CREATE TABLE IF NOT EXISTS meta (
//             zero INTEGER PRIMARY KEY,
//             config TEXT NOT NUL
//         )
//       `
//     ).run();
//
//     const config = stringify({
//       version: VERSION,
//       serverUrl: serverUrl,
//     });
//
//     const existingConfig: string | void = db
//       .prepare("SELECT config FROM meta")
//       .pluck()
//       .get();
//     if (existingConfig === config) {
//       // Already set up; nothing to do.
//       return;
//     } else if (existingConfig !== undefined) {
//       throw new Error(
//         "Database already populated with incompatible server or version"
//       );
//     }
//
//     const tables = [
//       dedent`\
//         CREATE TABLE users (username TEXT PRIMARY KEY),
//       `,
//
//       dedent`\
//         CREATE TABLE messages (
//             id TEXT NOT NULL PRIMARY KEY,
//             author_username TEXT,
//             text TEXT,
//             FOREIGN KEY(author_username) REFERENCES users(username)
//         )
//       `,
//     ]
//
//     for (const sql of tables) {
//       db.prepare(sql).run();
//     }
//   }
//
//
//
// }
