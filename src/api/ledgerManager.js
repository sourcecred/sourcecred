// @flow

import {Ledger, type LedgerLog} from "../core/ledger/ledger";
import {diffLedger, type LedgerDiff} from "../core/ledger/diffLedger";

/**
 * Generic adaptor for persisting a Ledger to some storage backend
 * (e.g. GitHub, local filesystem, a database, etc)
 */
export interface LedgerStorage {
  read(): Promise<Ledger>;
  write(ledger: Ledger): Promise<void>;
}

type LedgerManagerConfig = {|
  +storage: LedgerStorage,
  +initLogs?: LedgerLog,
|};

type ReloadResult = {|
  +error: string | null,
  +localChanges: LedgerDiff,
  +remoteChanges: LedgerDiff,
|};

export class LedgerManager {
  _ledger: Ledger;
  +_storage: LedgerStorage;

  constructor(config: LedgerManagerConfig) {
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
    const remoteLedger = await this._storage.read();
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
      this._ledger = await this._storage.read();
      return {
        error: `Unable to apply local changes: ${e.message}, resetting to remote ledger`,
        remoteChanges,
        localChanges,
      };
    }
  }
}
