// @flow

import {type NodeAddressT} from "../core/graph";
import {type Grain} from "../grain/grain";
import {type LedgerEvent} from "../grain/ledger";

export type Contributor = {|
  +address: NodeAddressT,
  // Markdown name (may contain hyperlinks)
  +name: string,
  +balance: Grain,
  +lastPeriodIssuance: Grain,
|};

export type MatchOptions = {|
  +exact: boolean,
|};

/**
 * The GrainMiddleware class provides data that's been preprocessed and
 * organized to closely match the needs of the grain frontend.
 */
export class GrainMiddleware {
  /*
   * Lists every contributor in the project, along with summary information
   * like their grain balance. In the future, we may add pagination.
   */
  contributors(): $ReadOnlyArray<Contributor> {
    throw new Error("Not yet implemented");
  }

  /**
   * Given the address of a contributor, return the summary information.
   */
  contributor(address: NodeAddressT): ?Contributor {
    throw new Error("Not yet implemented" + address);
  }

  /**
   * Returns all of the LedgerEvents corresponding to a particular contributor.
   * In the future, we will add options (e.g. on how the events should be sorted);
   * for now it will provide them in descending timestamp order.
   * In the future, we may change this to a paginated or asynchronous API.
   */
  events(address: NodeAddressT): $ReadOnlyArray<LedgerEvent> {
    throw new Error("Not yet implemented" + address);
  }

  /**
   * Fuzzily searches over the contributors to find ones that match the
   * search string. Assigns a score to each match based on its closeness.
   *
   * In the future, we may add options (e.g. for exactness).
   */
  autocomplete(
    search: string
  ): $ReadOnlyArray<{|+score: number, +contributor: Contributor|}> {
    throw new Error("Not yet implemented" + search);
  }

  /**
   * Returns timeseries data of how much total supply of Grain there's been at
   * every "issuance period". For now, we'll consider any timestamp which has
   * at least one Grain distribution to be an issuance period.
   */
  supplyTimeseries(): $ReadOnlyArray<{|
    +timestampMs: number,
    +supply: Grain,
  |}> {
    throw new Error("Not yet implemented");
  }
}
