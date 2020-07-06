// @flow

import {ArrayLog} from "./log";
import {type Ledger} from "./ledger";
import {type User} from "./user";
import {type Event} from "./events";
import {type ProjectionQueries} from "./projection";
import Projection from "./projection";
import * as Commands from "./commands";

/**
 * Honestly no clue how to name correctly. Which could be a smell.
 * If this was Java it would be called: WrapperManagerCoordinatorAPI
 *
 * But what it does is:
 * - Wrap command calls so they are fed the internal projection and have a
 *   side-effect interface.
 * - On a command call update both ledger and projection with events produced.
 * - Additionally provides read-only access to ledger and projection. To be a
 *   good OOP citizen and make an effort to encapsulate state.
 */
export class SyncedProjectionAndLedgerWithCommands {
  // RO ledger reference, because ledger itself is mutating.
  +_ledger: Ledger;
  // RW projection reference, because it's assumed to be immutable it will update.
  _state: Projection;

  constructor(ledger?: Ledger) {
    this._ledger = ledger || new ArrayLog();
    this._state = Projection.fromEvents(this._ledger);
  }

  // Read-only access to the events.
  events(): Iterator<Event> {
    return this._ledger.values();
  }

  // Read-only access to the projection.
  queries(): ProjectionQueries {
    return this._state;
  }

  trackUser(user: User): void {
    this._ingestEvents(Commands.trackUser(this._state, user));
  }

  _ingestEvents(events: Iterable<Event>): void {
    // Note: we're being eager here by appending to the ledger first.
    // As it's the Command's responsibility to not emit invalid events,
    // crashes in the Projection shouldn't be concern for appending.
    this._ledger.append(events);
    this._state = this._state.replay(events);
  }
}

// Fake the user.
// $FlowExpectedError
const user: User = {};

// Example usage
const theMonster = new SyncedProjectionAndLedgerWithCommands();
theMonster.trackUser(user);
