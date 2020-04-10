// @flow

import deepFreeze from "deep-freeze";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import stringify from "json-stable-stringify";
import * as NullUtil from "../util/null";
import sortBy from "../util/sortBy";
import {
  type Grain,
  format as formatGrain,
  ZERO,
  DECIMAL_PRECISION,
} from "./grain";

export opaque type EventOrderT = symbol;
export const EventOrder: {|
  +ASCENDING: EventOrderT,
  +DESCENDING: EventOrderT,
|} = deepFreeze({
  ASCENDING: Symbol("ASCENDING"),
  DESCENDING: Symbol("DESCENDING"),
});

export type EventsOptions = {|
  // The order to return results in (ASCENDING or DESCENDING).
  // Defaults to ASCENDING.
  +eventOrder: EventOrderT,
|};

export const DEFAULT_EVENTS_OPTIONS = deepFreeze({
  eventOrder: EventOrder.ASCENDING,
});

/**
 * Models a transfer of grain from a sender to recipient.
 * A grainholder may transfer grain to themself (which is a no-op).
 */
export type Transfer_v1 = {|
  +type: "TRANSFER",
  +version: string,
  +sender: NodeAddressT,
  +recipient: NodeAddressT,
  +amount: Grain,
  +timestampMs: number,
|};
export type Transfer = Transfer_v1;

/**
 * A harvest distributes newly minted grain to contributors.
 */
export type Harvest_v1 = {|
  +type: "HARVEST",
  +version: string,
  +receipts: $ReadOnlyArray<{|
    +address: NodeAddressT,
    +amount: Grain,
  |}>,
  +timestampMs: number,
|};
export type Harvest = Harvest_v1;

export type LedgerEvent = Harvest | Transfer;

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
   * Retrieve the events.
   *
   * Can be filtered and sorted based on the
   * EventsOptions, see that type for documentation.
   */
  events(?EventsOptions): $ReadOnlyArray<LedgerEvent>;
}

export class InMemoryLedger implements Ledger {
  _balances: Map<NodeAddressT, Grain>;
  _earnings: Map<NodeAddressT, Grain>;
  _events: $ReadOnlyArray<LedgerEvent>;

  /**
   * Construct a Ledger from an array of in-memory events.
   *
   * The events must be in timestamp sorted order.
   */
  constructor(events: $ReadOnlyArray<LedgerEvent>) {
    this._balances = new Map();
    this._earnings = new Map();
    this._events = events;
    let lastTimestamp = -Infinity;
    for (const e of events) {
      if (e.timestampMs < lastTimestamp) {
        throw new Error(
          `event timestamps out of order: encountered ${e.timestampMs} after ${lastTimestamp}`
        );
      }
      switch (e.type) {
        case "HARVEST":
          this._processHarvest((e: Harvest));
          break;
        case "TRANSFER":
          this._processTransfer((e: Transfer));
          break;
        default:
          throw new Error(`Unsupported event type: ${(e.type: empty)}`);
      }
    }
  }

  events(): $ReadOnlyArray<LedgerEvent> {
    return this._events.slice();
  }

  balances(): Map<NodeAddressT, Grain> {
    return new Map(this._balances);
  }

  _balance(a: NodeAddressT): Grain {
    return NullUtil.orElse(this._balances.get(a), ZERO);
  }

  _earning(a: NodeAddressT): Grain {
    return NullUtil.orElse(this._earnings.get(a), ZERO);
  }

  earnings(): Map<NodeAddressT, Grain> {
    return new Map(this._earnings);
  }

  _processHarvest(d: Harvest) {
    const {version, receipts} = d;
    if (version !== "0.1.0") {
      throw new Error(`Unsupported harvest version: ${version}`);
    }
    for (const {address, amount} of receipts) {
      const balance = this._balance(address) + amount;
      this._balances.set(address, balance);
      const earned = this._earning(address) + amount;
      this._earnings.set(address, earned);
    }
  }

  _processTransfer(t: Transfer) {
    const {recipient, sender, amount, version, timestampMs} = t;
    if (version !== "0.1.0") {
      throw new Error(`Unsupported transfer version: ${t.version}`);
    }
    const recipientBalance = this._balance(recipient);
    const senderBalance = this._balance(sender);
    if (senderBalance < amount) {
      const forDisplay = {
        amount: formatGrain(amount, DECIMAL_PRECISION),
        recipient: NodeAddress.toString(recipient),
        sender: NodeAddress.toString(sender),
        timestampMs: timestampMs,
      };
      throw new Error(
        `Invalid transfer (sender can't afford): ${stringify(forDisplay)}`
      );
    }
    if (sender === recipient) {
      // No need to do any update if the sender and recipient are the same.
      // (And using the logic below would cause grain to "vanish")
      return;
    }
    this._balances.set(recipient, recipientBalance + amount);
    this._balances.set(sender, senderBalance - amount);
  }
}
