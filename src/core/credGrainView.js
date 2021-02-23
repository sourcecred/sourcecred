// @flow

/**
 * This module exposes a class that accesses participant data, aggregating
 * between a CredGraph and a Ledger.
 *
 * It is useful for cases where you want to view a participant's Cred and Grain
 * data simultaneously, for example for creating summary dashboards.
 */
import deepFreeze from "deep-freeze";
import {
  CredGraph,
  type Participant as GraphParticipant,
} from "./credrank/credGraph";
import {type Identity, type IdentityId} from "./identity";
import * as G from "./ledger/grain";
import {type Grain} from "./ledger/grain";
import {Ledger, type Account} from "./ledger/ledger";
import {type TimestampMs} from "../util/timestamp";
import findLastIndex from "lodash.findlastindex";
import {type IntervalSequence, intervalSequence} from "./interval";

/**
 * Cred and Grain data for a given participant.
 *
 * Implicitly has an associated time scope, which will
 * be the time scope of the CredGrainView or TimeScopedCredGrainView that
 * generated this.
 *
 * The indices of credPerInterval/grainEarnedPerInterval correspond to the
 * same indices in the IntervalSequence of the CredGrainView or
 * TimeScopedCredGrainView that generated this.
 */
export type ParticipantCredGrain = {|
  +identity: Identity,
  // Total Cred earned during the time scope.
  +cred: number,
  // Cred earned in each interval within the time scope.
  +credPerInterval: $ReadOnlyArray<number>,
  // Total Grain earned during the time scope.
  +grainEarned: Grain,
  // Grain earned in each interval within the time scope.
  +grainEarnedPerInterval: $ReadOnlyArray<Grain>, 
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
  _participants: $ReadOnlyArray<ParticipantCredGrain>;
  _intervals: IntervalSequence;

  constructor(credGraph: CredGraph, ledger: Ledger) {
    this._credGraph = credGraph;
    this._ledger = ledger;
    this._intervals = deepFreeze(credGraph.intervals());

    const graphParticipants = new Map<IdentityId, GraphParticipant>();
    for (const participant of credGraph.participants()) {
      graphParticipants.set(participant.id, participant);
    }

    this._participants = deepFreeze(
      ledger.accounts().map((account) => {
        const graphParticipant = graphParticipants.get(account.identity.id);
        if (!graphParticipant)
          throw new Error(
            `The graph is missing account [${account.identity.name}: ${account.identity.id}] that exists in the ledger.`
          );

        return {
          identity: account.identity,
          cred: graphParticipant.cred,
          credPerInterval: graphParticipant.credPerInterval,
          grainEarned: account.paid,
          grainEarnedPerInterval: this._calculateGrainEarnedPerInterval(
            account
          ),
        };
      })
    );
  }

  _calculateGrainEarnedPerInterval(account: Account): $ReadOnlyArray<Grain> {
    return this._intervals.map((interval) => {
      let grain = G.ZERO;
      account.allocationHistory.forEach((allocationReceipt) => {
        if (
          interval.startTimeMs < allocationReceipt.credTimestampMs &&
          allocationReceipt.credTimestampMs <= interval.endTimeMs
        )
          grain = G.add(grain, allocationReceipt.grainReceipt.amount);
      });
      return grain;
    });
  }

  withTimeScope(
    startTimeMs: TimestampMs,
    endTimeMs: TimestampMs
  ): TimeScopedCredGrainView {
    return new TimeScopedCredGrainView(
      this._participants,
      this._intervals,
      startTimeMs,
      endTimeMs
    );
  }

  intervals(): IntervalSequence {
    return this._intervals;
  }

  participants(): $ReadOnlyArray<ParticipantCredGrain> {
    return this._participants;
  }
}

/**
 * This class's contructor stores a continuous subset of the originalIntervals
 * and participant cred/grain data where intervals are only included if their
 * start and end times are both within the provided startTimeMs and endTimeMs,
 * inclusively.
 */
export class TimeScopedCredGrainView {
  _participants: $ReadOnlyArray<ParticipantCredGrain>;
  _intervals: IntervalSequence;

  constructor(
    originalParticipants: $ReadOnlyArray<ParticipantCredGrain>,
    originalIntervals: IntervalSequence,
    startTimeMs: TimestampMs,
    endTimeMs: TimestampMs
  ) {
    let inclusiveStartIndex = originalIntervals.findIndex(
      (interval) => startTimeMs <= interval.startTimeMs
    );
    if (inclusiveStartIndex === -1)
      inclusiveStartIndex = originalIntervals.length;

    const exclusiveEndIndex =
      findLastIndex(
        originalIntervals,
        (interval) => interval.endTimeMs <= endTimeMs
      ) + 1;

    this._intervals = deepFreeze(
      intervalSequence(
        originalIntervals.slice(inclusiveStartIndex, exclusiveEndIndex)
      )
    );
    this._participants = deepFreeze(
      originalParticipants.map((participant) => {
        const credPerInterval = participant.credPerInterval.slice(
          inclusiveStartIndex,
          exclusiveEndIndex
        );
        const grainEarnedPerInterval = participant.grainEarnedPerInterval.slice(
          inclusiveStartIndex,
          exclusiveEndIndex
        );
        return {
          identity: participant.identity,
          cred: credPerInterval.reduce((a, b) => a + b, 0),
          credPerInterval,
          grainEarned: grainEarnedPerInterval.reduce(
            (a, b) => G.add(a, b || G.ZERO),
            G.ZERO
          ),
          grainEarnedPerInterval,
        };
      })
    );
  }

  intervals(): IntervalSequence {
    return this._intervals;
  }

  participants(): $ReadOnlyArray<ParticipantCredGrain> {
    return this._participants;
  }
}
