// @flow

/**
 * This module exposes a class that accesses participant data, aggregating
 * between a CredGraph and a Ledger.
 *
 * It is useful for cases where you want to view a participant's Cred and Grain
 * data simultaneously, for example for creating summary dashboards.
 */
import {sum} from "d3-array";
import deepFreeze from "deep-freeze";
import {
  CredGraph,
  type Participant as GraphParticipant,
} from "./credrank/credGraph";
import {type Identity, type IdentityId, identityParser} from "./identity";
import {weekIntervals} from "./interval";
import * as G from "./ledger/grain";
import {type Grain, add, ZERO} from "./ledger/grain";
import {Ledger, type Account} from "./ledger/ledger";
import type {ScoredContribution} from "./credequate/scoredContribution";
import {type TimestampMs} from "../util/timestamp";
import findLastIndex from "lodash.findlastindex";
import {
  type IntervalSequence,
  intervalSequence,
  intervalSequenceParser,
} from "./interval";
import * as C from "../util/combo";

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
  // Is the user active
  +active: boolean,
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

export type CredGrainViewJSON = {|
  +participants: $ReadOnlyArray<ParticipantCredGrain>,
  +intervals: IntervalSequence,
|};
export const credGrainViewParser: C.Parser<CredGrainView> = C.object({
  participants: C.array(
    C.object({
      active: C.boolean,
      identity: identityParser,
      cred: C.number,
      credPerInterval: C.array(C.number),
      grainEarned: G.parser,
      grainEarnedPerInterval: C.array(G.parser),
    })
  ),
  intervals: intervalSequenceParser,
}).fmap((json) => CredGrainView.fromJSON(json));

/**
 * Aggregates data across a CredGraph and Ledger.
 *
 * By default, it includes data across all time present in the instance.
 * Callers can call `withTimeScope` to get a `TimeScopedCredGrainView` which
 * returns data that only includes a continuous subset of cred and grain data
 * across time.
 */
export class CredGrainView {
  _participants: $ReadOnlyArray<ParticipantCredGrain>;
  _participantsMap: Map<IdentityId, ParticipantCredGrain>;
  _intervals: IntervalSequence;
  _credTotals: Array<number>;
  _grainTotals: Array<Grain>;

  constructor(
    participants: $ReadOnlyArray<ParticipantCredGrain> = [],
    intervals: IntervalSequence = intervalSequence([])
  ) {
    this._participants = participants;
    this._intervals = intervals;
    this._credTotals = [];
    this._grainTotals = [];
    this._participantsMap = new Map();
    participants.forEach((participant) => {
      this._participantsMap.set(participant.identity.id, participant);
      for (let i = 0; i < this._intervals.length; i++) {
        this._credTotals[i] =
          participant.credPerInterval[i] + (this._credTotals[i] || 0);
        this._grainTotals[i] = add(
          participant.grainEarnedPerInterval[i],
          this._grainTotals[i] || ZERO
        );
      }
    });
    this.validate();
  }

  static _calculateGrainEarnedPerInterval(
    account: Account,
    intervals: IntervalSequence
  ): $ReadOnlyArray<Grain> {
    let allocationIndex = 0;
    const result = intervals.map((interval) => {
      let grain = G.ZERO;
      while (
        account.allocationHistory.length - 1 >= allocationIndex &&
        interval.startTimeMs <=
          account.allocationHistory[allocationIndex].credTimestampMs &&
        account.allocationHistory[allocationIndex].credTimestampMs <
          interval.endTimeMs
      ) {
        grain = G.add(
          grain,
          account.allocationHistory[allocationIndex].grainReceipt.amount
        );
        allocationIndex++;
      }
      return grain;
    });
    return result;
  }

  validateForGrainAllocation() {
    if (this.activeParticipants().length === 0) {
      throw new Error(`must have at least one identity to allocate grain to`);
    }
    this.validate();
    if (sum(this.totalCredPerInterval()) < 1)
      throw new Error(
        "cred is zero. Make sure your plugins are configured correctly and remember to run 'yarn go' to calculate the cred scores."
      );
  }

  validate() {
    this.participants().forEach((p) => {
      p.credPerInterval.forEach((c) => {
        if (typeof c !== "number") {
          throw new Error(`Non numeric cred value found`);
        }
        if (c < 0) {
          throw new Error(`negative cred in interval data`);
        }
      });

      if (typeof p.cred !== "number") {
        throw new Error(`Non numeric cred value found`);
      }

      if (p.credPerInterval.length !== this.intervals().length) {
        throw new Error(
          `participant cred per interval length mismatch: ${
            p.credPerInterval.length
          } and ${this.intervals().length}`
        );
      }

      if (p.grainEarnedPerInterval.length !== this.intervals().length) {
        throw new Error(`participant grain per interval length mismatch`);
      }

      if (sum(p.credPerInterval).toFixed(6) !== p.cred.toFixed(6)) {
        throw new Error(
          `participant cred per interval sum [${sum(
            p.credPerInterval
          )}] mismatched with participant cred total [${p.cred}]`
        );
      }

      if (!G.eq(G.sum(p.grainEarnedPerInterval), p.grainEarned)) {
        throw new Error(
          `participant grain per interval [${G.sum(
            p.grainEarnedPerInterval
          )}] mismatched with participant grain total [${
            p.grainEarned
          }] for participant [${p.identity.name}]`
        );
      }

      p.grainEarnedPerInterval.forEach((g) => {
        if (g < G.ZERO) {
          throw new Error(`negative grain paid in interval data`);
        }
      });
    });
  }

  withTimeScope(
    startTimeMs: TimestampMs,
    endTimeMs: TimestampMs
  ): TimeScopedCredGrainView {
    return new TimeScopedCredGrainView(this, startTimeMs, endTimeMs);
  }

  withTimeScopeFromLookback(
    effectiveTimestamp: TimestampMs,
    numIntervalsLookback: number
  ): TimeScopedCredGrainView {
    const intervalsBeforeEffective = this._intervals.filter(
      (interval) => interval.endTimeMs <= effectiveTimestamp
    );

    if (!numIntervalsLookback)
      return new TimeScopedCredGrainView(this, -Infinity, effectiveTimestamp);

    if (
      !intervalsBeforeEffective ||
      intervalsBeforeEffective.length <= numIntervalsLookback
    )
      return new TimeScopedCredGrainView(this, -Infinity, effectiveTimestamp);

    return new TimeScopedCredGrainView(
      this,
      intervalsBeforeEffective[
        intervalsBeforeEffective.length - numIntervalsLookback
      ].startTimeMs,
      effectiveTimestamp
    );
  }

  intervals(): IntervalSequence {
    return this._intervals;
  }

  participants(): $ReadOnlyArray<ParticipantCredGrain> {
    return this._participants;
  }

  /** Returns the data for the participant with the given ID */
  participant(id: IdentityId): ParticipantCredGrain {
    const result = this._participantsMap.get(id);
    if (!result)
      throw new Error(
        `Participant [${id}] does not exist in the CredGrainView.`
      );
    return result;
  }

  activeParticipants(): $ReadOnlyArray<ParticipantCredGrain> {
    return this._participants.filter((participant) => participant.active);
  }

  // This is imprecise, due to floating point rounding.
  totalCredPerInterval(): $ReadOnlyArray<number> {
    return this._credTotals;
  }

  totalGrainPerInterval(): $ReadOnlyArray<Grain> {
    return this._grainTotals;
  }

  toJSON(): CredGrainViewJSON {
    return {
      participants: this._participants,
      intervals: this._intervals,
    };
  }

  static fromJSON(json: CredGrainViewJSON): CredGrainView {
    return new CredGrainView(json.participants, json.intervals);
  }

  withNewLedger(ledger: Ledger): CredGrainView {
    const participants = ledger.accounts().map((account) => {
      const grainEarnedPerInterval = CredGrainView._calculateGrainEarnedPerInterval(
        account,
        this._intervals
      );
      const participant = this._participants.find(
        (p) => p.identity.id === account.identity.id
      );
      if (!participant)
        throw new Error(
          `CredGrainView.withNewLedger: new ledger has identity ID [${account.identity.id}] that is not in already in the CredGrainView.`
        );
      return {
        ...participant,
        active: account.active,
        grainEarned: account.paid,
        grainEarnedPerInterval,
      };
    });
    return new CredGrainView(participants, this._intervals);
  }

  /**
Creates a CredGrainView using the output of the CredRank API.
 */
  static fromCredGraphAndLedger(
    credGraph: CredGraph,
    ledger: Ledger
  ): CredGrainView {
    const ledgerCredTimestamps = ledger
      .eventLog()
      .map((e) => {
        if (e.action.type === "DISTRIBUTE_GRAIN")
          return e.action.distribution.credTimestamp;
        return -Infinity;
      })
      .filter((t) => t > -Infinity);
    const intervals = weekIntervals(
      Math.min(...ledgerCredTimestamps, credGraph.intervals()[0].startTimeMs),
      Math.max(
        ...ledgerCredTimestamps,
        credGraph.intervals()[credGraph.intervals().length - 1].endTimeMs - 1
      )
    );
    const intervalMap = new Map();
    intervals.forEach((interval, index) => {
      const graphIndex = credGraph
        .intervals()
        .findIndex((i) => i.startTimeMs === interval.startTimeMs);
      intervalMap.set(index, graphIndex);
    });

    const graphParticipants = new Map<IdentityId, GraphParticipant>();
    for (const participant of credGraph.participants()) {
      graphParticipants.set(participant.id, participant);
    }

    const participants = deepFreeze(
      ledger.accounts().map((account) => {
        const graphParticipant = graphParticipants.get(account.identity.id);
        if (!graphParticipant)
          throw new Error(
            `The graph is missing account [${account.identity.name}: ${account.identity.id}] that exists in the ledger. Try recalculating the scores.`
          );

        const grainEarnedPerInterval = this._calculateGrainEarnedPerInterval(
          account,
          intervals
        );
        const credPerInterval = intervals.map((interval, index) => {
          const graphIndex = intervalMap.get(index);
          if (graphIndex === undefined || graphIndex === -1) return 0;
          return graphParticipant.credPerInterval[graphIndex];
        });
        return {
          active: account.active,
          identity: account.identity,
          cred: graphParticipant.cred,
          credPerInterval: credPerInterval,
          grainEarned: account.paid,
          grainEarnedPerInterval,
        };
      })
    );
    return new CredGrainView(participants, intervals);
  }

  /**
Creates a CredGrainView using the output of the CredEquate API.
 */
  static fromScoredContributionsAndLedger(
    scoredContributions: Iterable<ScoredContribution>,
    ledger: Ledger,
    startTimeMs: TimestampMs
  ): CredGrainView {
    const ledgerCredTimestamps = ledger
      .eventLog()
      .map((e) => {
        if (e.action.type === "DISTRIBUTE_GRAIN")
          return e.action.distribution.credTimestamp;
        return -Infinity;
      })
      .filter((t) => t > -Infinity);

    const intervals = weekIntervals(
      Math.min(...ledgerCredTimestamps, startTimeMs),
      Math.max(...ledgerCredTimestamps, Date.now())
    );
    const participantsMap = new Map();
    const participantPrototypes = ledger.accounts().map((account) => {
      const grainEarnedPerInterval = this._calculateGrainEarnedPerInterval(
        account,
        intervals
      );
      const participant = {
        active: account.active,
        identity: account.identity,
        credPerInterval: Array.from(Array(intervals.length)),
        grainEarned: account.paid,
        grainEarnedPerInterval,
      };
      for (const alias of account.identity.aliases) {
        participantsMap.set(alias.address, participant);
      }
      participantsMap.set(account.identity.address, participant);
      return participant;
    });

    for (const scoredContribution of scoredContributions) {
      for (const participant of scoredContribution.participants) {
        const p = participantsMap.get(participant.id);
        if (!p) continue;
        const index = intervals.findIndex(
          (interval) => interval.endTimeMs > scoredContribution.timestampMs
        );
        p.credPerInterval[index] =
          (p.credPerInterval[index] ?? 0) + participant.score;
      }
    }

    const participants = participantPrototypes.map((p) => {
      return {
        ...p,
        cred: p.credPerInterval.reduce((a, b, index) => {
          if (!b) p.credPerInterval[index] = 0;
          return a + (b ?? 0);
        }, 0),
      };
    });

    return new CredGrainView(participants, intervals);
  }

  /**
Combines multiple CredGrainViews into a single one. The intervals will span the
earliest to the latest of all intervals in all the CredGrainViews.
Participant identity/active data will match that of the first occurrence of
that participant in the params.
 */
  static fromCredGrainViews(
    ...views: $ReadOnlyArray<CredGrainView>
  ): CredGrainView {
    const allIntervals = views.flatMap((view) => view.intervals());
    const intervals = weekIntervals(
      Math.min(...allIntervals.map((i) => i.startTimeMs)),
      Math.max(...allIntervals.map((i) => i.endTimeMs - 1))
    );
    const participants = new Map();
    for (const view of views) {
      const indexOffset = intervals.findIndex(
        (i) => i.startTimeMs === view.intervals()[0].startTimeMs
      );
      for (const participant of view.participants()) {
        let existing = participants.get(participant.identity.id);
        if (!existing) {
          const credPerInterval = intervals.map(() => 0);
          const grainEarnedPerInterval = intervals.map(() => G.ZERO);
          existing = {
            credPerInterval,
            grainEarnedPerInterval,
            grainEarned: G.ZERO,
            cred: 0,
            identity: participant.identity,
            active: participant.active,
          };
          participants.set(existing.identity.id, existing);
        }
        participant.credPerInterval.forEach((cred, index) => {
          if (!existing)
            // Makes flow happy
            throw "CredGrainView.fromCredGrainViews: this should not happen";
          existing.cred += cred;
          existing.credPerInterval[index + indexOffset] += cred;
        });
        participant.grainEarnedPerInterval.forEach((grain, index) => {
          if (!existing)
            // Makes flow happy
            throw "CredGrainView.fromCredGrainViews: this should not happen";
          existing.grainEarned = G.add(existing.grainEarned, grain);
          existing.grainEarnedPerInterval[index + indexOffset] = G.add(
            existing.grainEarnedPerInterval[index + indexOffset],
            grain
          );
        });
      }
    }
    return new CredGrainView(
      Array.from(participants.values()),
      intervalSequence(intervals)
    );
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
  _participantsMap: Map<IdentityId, ParticipantCredGrain>;
  _intervals: IntervalSequence;
  _credTotals: $ReadOnlyArray<number>;
  _grainTotals: $ReadOnlyArray<Grain>;

  constructor(
    credGrainView: CredGrainView,
    startTimeMs: TimestampMs,
    endTimeMs: TimestampMs
  ) {
    const originalIntervals = credGrainView.intervals();
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
    this._participantsMap = new Map();
    this._participants = deepFreeze(
      credGrainView.participants().map((participant) => {
        const credPerInterval = participant.credPerInterval.slice(
          inclusiveStartIndex,
          exclusiveEndIndex
        );
        const grainEarnedPerInterval = participant.grainEarnedPerInterval.slice(
          inclusiveStartIndex,
          exclusiveEndIndex
        );
        const result = {
          active: participant.active,
          identity: participant.identity,
          cred: credPerInterval.reduce((a, b) => a + b, 0),
          credPerInterval,
          grainEarned: grainEarnedPerInterval.reduce(
            (a, b) => G.add(a, b || G.ZERO),
            G.ZERO
          ),
          grainEarnedPerInterval,
        };
        this._participantsMap.set(result.identity.id, result);
        return result;
      })
    );
    this._credTotals = credGrainView
      .totalCredPerInterval()
      .slice(inclusiveStartIndex, exclusiveEndIndex);
    this._grainTotals = credGrainView
      .totalGrainPerInterval()
      .slice(inclusiveStartIndex, exclusiveEndIndex);
  }

  intervals(): IntervalSequence {
    return this._intervals;
  }

  participants(): $ReadOnlyArray<ParticipantCredGrain> {
    return this._participants;
  }

  participant(id: IdentityId): ParticipantCredGrain {
    const result = this._participantsMap.get(id);
    if (!result)
      throw new Error(
        `Participant [${id}] does not exist in the CredGrainView.`
      );
    return result;
  }

  activeParticipants(): $ReadOnlyArray<ParticipantCredGrain> {
    return this._participants.filter((participant) => participant.active);
  }

  // This is imprecise, due to floating point rounding.
  totalCredPerInterval(): $ReadOnlyArray<number> {
    return this._credTotals;
  }

  totalGrainPerInterval(): $ReadOnlyArray<Grain> {
    return this._grainTotals;
  }
}
