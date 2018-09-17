// @flow

import type Database from "better-sqlite3";

/**
 * Execute a function inside a database transaction.
 *
 * The database must not be in a transaction. A new transaction will be
 * entered, and then the callback will be invoked.
 *
 * If the callback completes normally, then its return value is passed
 * up to the caller, and the currently active transaction (if any) is
 * committed.
 *
 * If the callback throws an error, then the error is propagated to the
 * caller, and the currently active transaction (if any) is rolled back.
 *
 * Note that the callback may choose to commit or roll back the
 * transaction before returning or throwing an error. Conversely, note
 * that if the callback commits the transaction, and then begins a new
 * transaction but does not end it, then this function will commit the
 * new transaction if the callback returns (or roll it back if it
 * throws).
 */
export function _inTransaction<R>(db: Database, fn: () => R): R {
  if (db.inTransaction) {
    throw new Error("already in transaction");
  }
  try {
    db.prepare("BEGIN").run();
    const result = fn();
    if (db.inTransaction) {
      db.prepare("COMMIT").run();
    }
    return result;
  } finally {
    if (db.inTransaction) {
      db.prepare("ROLLBACK").run();
    }
  }
}
