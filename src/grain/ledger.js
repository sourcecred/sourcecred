// @flow

import deepFreeze from "deep-freeze";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import stringify from "json-stable-stringify";
import * as NullUtil from "../util/null";
import sortBy from "../util/sortBy";
import {
  type Grain,
  format as formatGrain,
  zero,
  decimalPrecision,
} from "./grain";

export opaque type EventOrderT = symbol;
export const EventOrder: {|
  +ASCENDING: EventOrderT,
  +DESCENDING: EventOrderT,
|} = deepFreeze({
  ASCENDING: Symbol("ASCENDING"),
  DESCENDING: Symbol("DESCENDING"),
});

export opaque type EventSortT = symbol;
export const EventSort: {|
  +AMOUNT: EventSortT,
  +TIMESTAMP: EventSortT,
|} = deepFreeze({
  AMOUNT: Symbol("AMOUNT"),
  TIMESTAMP: Symbol("TIMESTAMP"),
});

export type EventsOptions = {|
  // The address to filter for; events will be returned if this address is
  // involved at all (e.g. as a recipient or sender).
  // Only exact address matches are included (no prefix matching).
  // If null, all addresses are included.
  +address: NodeAddressT | null,
  // The order to return results in (ASCENDING or DESCENDING).
  // Defaults to ASCENDING.
  +eventOrder: EventOrderT,
  // The sorting strategy to use (by TIMESTAMP or by AMOUNT).
  // Defaults to TIMESTAMP.
  +eventSort: EventSortT,
|};

export const DEFAULT_EVENTS_OPTIONS = deepFreeze({
  address: null,
  eventOrder: EventOrder.ASCENDING,
  eventSort: EventSort.TIMESTAMP,
});

/**
 * Models a transfer of grain from a sender to recipient.
 * A grainholder may transfer grain to themself (which is a no-op).
 */
export type Transfer = {|
  +type: "TRANSFER",
  +version: string,
  +sender: NodeAddressT,
  +recipient: NodeAddressT,
  +amount: Grain,
  +timestampMs: number,
|};

/**
 * Models a participant recieving newly minted grain.
 */
export type Distribution = {|
  +type: "DISTRIBUTION",
  +version: string,
  +recipient: NodeAddressT,
  +amount: Grain,
  +timestampMs: number,
|};

export type LedgerEvent = Distribution | Transfer;

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
        case "DISTRIBUTION":
          this._processDistribution((e: Distribution));
          break;
        case "TRANSFER":
          this._processTransfer((e: Transfer));
          break;
        default:
          throw new Error(`Unsupported event type: ${(e.type: empty)}`);
      }
    }
  }

  events(options: ?$Shape<EventsOptions>): $ReadOnlyArray<LedgerEvent> {
    const fullOptions = {
      ...DEFAULT_EVENTS_OPTIONS,
      ...NullUtil.orElse(options, {}),
    };
    const {address, eventOrder, eventSort} = fullOptions;
    let filter = (_) => true;
    if (address) {
      filter = (x: LedgerEvent) => {
        switch (x.type) {
          case "DISTRIBUTION":
            return x.recipient === address;
          case "TRANSFER":
            return x.recipient === address || x.sender === address;
          default:
            throw new Error((x.type: empty));
        }
      };
    }
    const events = this._events.filter(filter);
    const sorted =
      eventSort === EventSort.AMOUNT ? sortBy(events, (x) => x.amount) : events;
    if (eventOrder === EventOrder.DESCENDING) {
      sorted.reverse();
    }
    return sorted;
  }

  balances(): Map<NodeAddressT, Grain> {
    return new Map(this._balances);
  }

  _balance(a: NodeAddressT): Grain {
    return NullUtil.orElse(this._balances.get(a), zero);
  }

  _earning(a: NodeAddressT): Grain {
    return NullUtil.orElse(this._earnings.get(a), zero);
  }

  earnings(): Map<NodeAddressT, Grain> {
    return new Map(this._earnings);
  }

  _processDistribution(d: Distribution) {
    const {version, recipient, amount} = d;
    if (version !== "0.1.0") {
      throw new Error(`Unsupported distribution version: ${version}`);
    }
    const balance = this._balance(recipient) + amount;
    this._balances.set(recipient, balance);
    const earned = this._earning(recipient) + amount;
    this._earnings.set(recipient, earned);
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
        amount: formatGrain(amount, decimalPrecision),
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
