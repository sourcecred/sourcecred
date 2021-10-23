// @flow

import {Ledger, type LedgerLog} from "../core/ledger/ledger";
import {diffLedger, type LedgerDiff} from "../core/ledger/diffLedger";
import type {WritableDataStorage} from "../core/storage";
import {decode, encode} from "../core/storage/textEncoding";

/**
 * Generic adaptor for persisting a Ledger to some storage backend
 * (e.g. GitHub, local filesystem, a database, etc)
 */
export interface LedgerStorage {
  read(): Promise<Ledger>;
  write(ledger: Ledger): Promise<void>;
}

type LedgerManagerConfig = {|
  +storage: WritableDataStorage,
  +initLogs?: LedgerLog,
  +path?: string,
|};

type ReloadResult = {|
  +error: string | null,
  +localChanges: LedgerDiff,
  +remoteChanges: LedgerDiff,
|};

export class LedgerManager {
  _ledger: Ledger;
  +_storage: WritableDataStorage;
  _path: string;

  constructor(config: LedgerManagerConfig) {
    this._path = config.path ?? "data/ledger.json";
    this._storage = config.storage;
    this._ledger = config.initLogs
      ? Ledger.fromEventLog(config.initLogs)
      : new Ledger();
  }

  get ledger(): Ledger {
    return this._ledger;
  }

  /**
   * Returns a list of LedgerEvents that have not been persisted to storage yet
   */
  _getLocalChanges(remoteLedger: Ledger): LedgerDiff {
    return diffLedger(this._ledger, remoteLedger);
  }

  /**
   * Returns a list of LedgerEvents in the persisted ledger that have not been
   * applied to the local ledger.
   */
  _getRemoteChanges(remoteLedger: Ledger): LedgerDiff {
    return diffLedger(remoteLedger, this._ledger);
  }

  /**
   * Persists the local (in-memory) Ledger to the ledger storage. Reloads the
   * remote ledger from storage right before persisting it to minimize the
   * possibility of overwriting remote changes that were not synced to the local
   * ledger and ensure consistency of the ledger events (e.g. no double spends).
   *
   * A race condition is present in this function: if client A runs reloadLedger
   * and then client B writes to the remote ledger before client A finishes writing,
   * then the changes to the ledger that client B made would be overwritten by the
   * changes from client A. The correctness and consistency of the ledger will still
   * be maintained, its just that client B might experience data loss of whatever
   * events they were trying to sync. To detect if this has occurred, we reload
   * the ledger again after writing the data to ensure the local changes were
   * not overwritten. If they were, we can show an error message to client B with
   * a list of changes that failed to sync.
   */
  async persist(): Promise<ReloadResult> {
    // START RACE CONDITION
    const preWriteReloadRes = await this.reloadLedger();
    if (preWriteReloadRes.error) {
      return preWriteReloadRes;
    }
    await this._storage.set(this._path, encode(this._ledger.serialize()));
    // END RACE CONDITION

    // Reload ledger again to ensure all the changes were persisted into storage
    const postWriteReloadRes = await this.reloadLedger();
    if (postWriteReloadRes.error) {
      return postWriteReloadRes;
    }

    if (postWriteReloadRes.localChanges.length !== 0) {
      return {
        ...postWriteReloadRes,
        error: "Some local changes have not been persisted",
      };
    }

    return postWriteReloadRes;
  }

  /** Reloads the persisted Ledger from storage and replays any local changes
   *  on top of any new remote changes, if they exist.
   *
   *  Will return the list of new remote changes as well as a list of local
   *  changes that have not been persisted yet. This data is useful for the
   *  end user to know:
   *  - what changes they have yet to save
   *  - what new remote changes have been applied
   *  - if there are any inconsistencies as a result of new remote changes that
   *    conflict with the local changes (e.g. double spend)
   */
  async reloadLedger(): Promise<ReloadResult> {
    let remoteLedger: Ledger;
    try {
      remoteLedger = await this._getLedger();
    } catch (e) {
      return {
        error: e.message,
        remoteChanges: [],
        localChanges: [],
      };
    }

    const localChanges = this._getLocalChanges(remoteLedger);
    const remoteChanges = this._getRemoteChanges(remoteLedger);

    if (!remoteChanges.length) {
      return {error: null, remoteChanges: [], localChanges};
    }

    try {
      // Replay local actions, will throw if any local changes break ledger consistency
      for (const event of localChanges) {
        remoteLedger._createAndProcessEvent(event.action);
      }

      this._ledger = remoteLedger;
      return {
        error: null,
        remoteChanges,
        localChanges,
      };
    } catch (e) {
      // Reset local ledger to the remote state
      this._ledger = await this._getLedger();

      return {
        error: `Unable to apply local changes: ${e.message}, resetting to remote ledger`,
        remoteChanges,
        localChanges,
      };
    }
  }

  async _getLedger(): Promise<Ledger> {
    const encodedLedger = await this._storage.get(this._path);
    return Ledger.parse(decode(encodedLedger));
  }
}
