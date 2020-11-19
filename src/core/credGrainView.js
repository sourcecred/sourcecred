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
 * be the time scope of the TimeScopedCredGrainView that generated
 * this.
 */
export type ParticipantCredGrain = {|
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
  // How to sort. Always sorts from highest to lowest.
  // Defaults to BY_CRED
  +sort?: ParticipantSort,
  // Which identity types should be included.
  // Defaults to including all types.
  +includedTypes?: Set<IdentityType>,
|};

/**
 * Aggregates data across a CredGraph and Ledger.
 *
 * By default, it includes data across all time present in the instance.
 * Callers can call `withTimeScope` to get a `TimeScopedCredGrainView` which
 * returns data that only includes a continuous subset of cred and grain data
 * across time.
 */
export class CredGrainView {
  _credGraph: CredGraph;
  _ledger: Ledger;
  _defaultTimeScope: TimeScopedCredGrainView;

  constructor(credGraph: CredGraph, ledger: Ledger) {
    this._credGraph = credGraph;
    this._ledger = ledger;
    this._defaultTimeScope = new TimeScopedCredGrainView(
      credGraph,
      ledger,
      -Infinity,
      Infinity
    );
  }

  withTimeScope(
    startTimeMs: number,
    endTimeMs: number
  ): TimeScopedCredGrainView {
    return new TimeScopedCredGrainView(
      this._credGraph,
      this._ledger,
      startTimeMs,
      endTimeMs
    );
  }

  intervals(): IntervalSequence {
    return this._defaultTimeScope.intervals();
  }

  participant(id: IdentityId): ParticipantCredGrain | null {
    return this._defaultTimeScope.participant(id);
  }

  participants(
    options: ParticipantsOptions
  ): $ReadOnlyArray<ParticipantCredGrain> {
    return this._defaultTimeScope.participants(options);
  }
}

export class TimeScopedCredGrainView {
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

  participants(
    options: ParticipantsOptions
  ): $ReadOnlyArray<ParticipantCredGrain> {
    const _ = options;
    throw new Error("not yet implemented");
  }

  participant(id: IdentityId): ParticipantCredGrain | null {
    const _ = id;
    throw new Error("not yet implemented");
  }

  intervals(): IntervalSequence {
    throw new Error("not yet implemented");
  }
}
