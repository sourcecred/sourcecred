// @flow

/**
 * This module exposes a class that accesses participant data, aggregating
 * between a CredGraph and a Ledger.
 *
 * It is useful for cases where you want to view a participant's Cred and Grain
 * data simultaneously, for example for creating summary dashboards.
 */
import {CredGraph} from "./credrank/credGraph";
import {type Identity, type IdentityType, type IdentityId} from "./identity";
import {type Grain} from "./ledger/grain";
import {Ledger} from "./ledger/ledger";
import {type TimestampMs} from "../util/timestamp";
import {type IntervalSequence} from "./interval";

/**
 * Cred and Grain data for a given participant.
 *
 * Implicitly has an associated time scope, which will
 * be the time scope of the TimeScopedCredLedger that generated
 * this.
 */
export type ParticipantData = {|
  +identity: Identity,
  // Total Cred earned during the time scope.
  +cred: number,
  // Cred earned in each interval within the time scope.
  +credOverTime: $ReadOnlyArray<number>,
  // Total Grain earned during the time scope.
  +grainEarned: Grain,
  // Grain earned in each interval within the time scope.
  +grainEarnedOverTime: $ReadOnlyArray<Grain>,
|};

export type ParticipantSort = "BY_CRED" | "BY_GRAIN";
export type ParticipantsOptions = {|
  +sort?: ParticipantSort,
  // Which identity types should be included.
  // Defaults to including all types.
  +includedTypes?: Set<IdentityType>,
  // Minimum Cred required to be included in the results.
  // Defaults to including all participants regardless of
  // Cred.
  +minCred?: number,
  // Minimum Grain earnings required to be included in results.
  // Defaults to including all participants regardless of Grain.
  +minGrain?: Grain,
|};

/**
 * Aggregates data across a CredGraph and Ledger.
 *
 * By default, it includes data across all time present in the instance.
 * Callers can call `withTimeScope` to get a `TimeScopedCredLedger` which
 * returns data that only includes a continuous subset of cred and grain data
 * across time.
 */
export class CredLedger {
  _credGraph: CredGraph;
  _ledger: Ledger;
  _defaultTimeScope: TimeScopedCredLedger;

  constructor(credGraph: CredGraph, ledger: Ledger) {
    this._credGraph = credGraph;
    this._ledger = ledger;
    this._defaultTimeScope = new TimeScopedCredLedger(
      credGraph,
      ledger,
      -Infinity,
      Infinity
    );
  }

  withTimeScope(startTimeMs: number, endTimeMs: number): TimeScopedCredLedger {
    return new TimeScopedCredLedger(
      this._credGraph,
      this._ledger,
      startTimeMs,
      endTimeMs
    );
  }

  intervals(): IntervalSequence {
    return this._defaultTimeScope.intervals();
  }

  participant(id: IdentityId): ParticipantData | null {
    return this._defaultTimeScope.participant(id);
  }

  participants(options: ParticipantsOptions): $ReadOnlyArray<ParticipantData> {
    return this._defaultTimeScope.participants(options);
  }
}

export class TimeScopedCredLedger {
  _credGraph: CredGraph;
  _ledger: Ledger;
  _startTimeMs: TimestampMs;
  _endTimeMs: TimestampMs;

  constructor(
    credGraph: CredGraph,
    ledger: Ledger,
    startTimeMs: TimestampMs,
    endTimeMs: TimestampMs
  ) {
    this._credGraph = credGraph;
    this._ledger = ledger;
    this._startTimeMs = startTimeMs;
    this._endTimeMs = endTimeMs;
  }

  participants(options: ParticipantsOptions): $ReadOnlyArray<ParticipantData> {
    const _ = options;
    throw new Error("not yet implemented");
  }

  participant(id: IdentityId): ParticipantData | null {
    const _ = id;
    throw new Error("not yet implemented");
  }

  intervals(): IntervalSequence {
    throw new Error("not yet implemented");
  }
}
