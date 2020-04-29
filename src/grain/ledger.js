// @flow

import {type NodeAddressT} from "../core/graph";
import {type Grain} from "./grain";

/**
 * Tracks a transfer of grain between participants.
 *
 * A grainholder may transfer grain to themself (which is a no-op).
 * A transfer that would result in the sender having a negative balance
 * is illegal.
 */
export type GrainTransferredV1 = {|
  +type: "GRAIN_TRANSFERRED",
  +version: number,
  +sender: NodeAddressT,
  +recipient: NodeAddressT,
  +amount: Grain,
  +timestampMs: number,
  +memo: string,
|};

// TODO: Import GrainAllocation once it merges.
type GrainAllocation = {};

/**
 * Tracks a distrbution of newly-minted grain to contributors.
 *
 * Each Distribution contains zero or more allocations, which
 * actually contain the mapping of new grain amounts to contributors.
 */
export type GrainDistributedV1 = {|
  +type: "GRAIN_DISTRIBUTED",
  +version: number,
  +timestamMs: number,
  +memo: string,
  +allocations: $ReadOnlyArray<GrainAllocation>,
|};

/**
 * Record that an "alias" identity is equivalent to a "canonical" identity.
 *
 * This event permanently records that one user NodeAddress (the alias) is
 * equivalent to another NodeAddress (the canonical address). this is useful
 * if, for example, a user has both a GitHub and a Discourse account. Once the
 * identities are merged, they cannot be separated (as doing so risks creating
 * negative balances). We may need to implement un-merging in the future; see
 * discussion below:
 * https://github.com/sourcecred/sourcecred/pull/1774#discussion_r419179404
 *
 * If a user has multiple aliases, then they should have multiple identity
 * merge events.
 *
 * If an identity merge has the same address as alias and canonical, it is a
 * no-op.
 *
 * It is allowed for the "canonical" address of one identity merge to later
 * be the "alias" of another merge.
 *
 * After the identity merge, any events which reference an alias address will
 * be treated as though they referenced the canonical address. (E.g., a
 * transfer to an alias will be received by the canonical address.) This rule
 * even applies to future identity merge events. As such, if we had an identity
 * merge saying that "A" is an alias of "B", and a future merge saying that "B"
 * is an alias of "A", this would be re-written to saying that "B" is an alias
 * of "B", which is a no-op.
 */
export type IdentityMergedV1 = {|
  +type: "IDENTITY_MERGED",
  +version: number,
  +timestampMs: number,
  +alias: NodeAddressT,
  +canonical: NodeAddressT,
  +memo: string,
|};

export type LedgerEvent =
  | GrainDistributedV1
  | IdentityMergedV1
  | GrainTransferredV1;

/**
 * A ledger tracks balances, earnings, and the event history of participants.
 *
 * We may refactor the `events` to be an async generator in the future,
 * when we stop storing all the events in memory.
 */
export interface Ledger {
  /**
   * Stores the current grain balance of each address.
   */
  balances(): Map<NodeAddressT, Grain>;

  /**
   * Stores the lifetime earnings of each address.
   *
   * Necessary for computing which participants have been underpaid.
   */
  earnings(): Map<NodeAddressT, Grain>;

  /**
   * Retrieve the full history of all LedgerEvents.
   */
  events(): $ReadOnlyArray<LedgerEvent>;

  /**
   * For each address, list all known aliases.
   *
   * Addresses that are present in the history but have no aliases will be
   * included, and will map to an empty array.
   */
  aliases(): Map<NodeAddressT, $ReadOnlyArray<NodeAddressT>>;
}
