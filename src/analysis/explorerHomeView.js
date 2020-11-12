// @flow
import {CredGraph} from "../core/credrank/credGraph";
import {type TimestampMs} from "../util/timestamp";
import {type Interval} from "../core/interval";
import * as Grain from "../core/ledger/grain";

export type DataOverTime = $ReadOnlyArray<number>;

export type UserRow = {|
  +name: string,
  +credEarnedInTimeRange: number,
  +grainHarvestedInTimeRange: Grain.Grain,
  +grainBalance: Grain.Grain,
  +allTimeCred: DataOverTime,
  +category: UserCategory,
|};

export type UserCategory = "participant" | "bot" | "project" | "organization";

export type ExplorerHomeView = {|
  +credEarned: number,
  +grainHarvested: Grain.Grain,
  +participantCount: number, //Question: what is this supposed to capture? Is it supposed to change depending on the time range selected?
  +grainPerCred: Grain.Grain,
  +userRows: $ReadOnlyArray<UserRow>,
  +intervalsIncluded: $ReadOnlyArray<Interval>,
|};

/**
  Responsible for transforming data from the CredGraph and LedgerLog(?) into the information needed by the Explorer Home web page.
 */
export class ExplorerHomeViewBuilder {
  constructor(credGraph: CredGraph) {
    credGraph;
    //Other params, depending on implementation. Probably a new GrainData API.
    //Saves params or transforms them, depending on implementation strategy
  }

  /**
    Returns all available intervals.
    Useful for determining appropriate time ranges to offer for selection.
   */
  getAllIntervals(): $ReadOnlyArray<Interval> {
    return [];
  }

  /**
    Returns the timelines aggregated over all available intervals.
   */
  getAggregateTimelines(): {|
    +credOverTime: DataOverTime,
    +grainOverTime: DataOverTime,
    +totalParticipantsOverTime: DataOverTime,
  |} {
    return {
      credOverTime: [],
      grainOverTime: [],
      totalParticipantsOverTime: [],
    };
  }

  /**
    1. Narrows time range to only include intervals that start and end in the range [startTime-inclusive, endTime-inclusive]
    2. Grain distributions are included if their timestamp is in the narrowed range (firstIntervalStartTime-exclusive, lastIntervalEndTime-inclusive]
   */
  getExplorerHomeView(
    startTime?: TimestampMs,
    endTime?: TimestampMs
  ): ExplorerHomeView {
    //to pass build
    startTime;
    endTime;
    return {
      credEarned: 0,
      grainHarvested: Grain.ZERO,
      participantCount: 0,
      grainPerCred: Grain.ZERO,
      userRows: [],
      intervalsIncluded: [],
    };
  }
}
