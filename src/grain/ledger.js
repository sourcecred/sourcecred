// @flow

import {type NodeAddressT, NodeAddress} from "../core/graph";
import stringify from "json-stable-stringify";
import * as NullUtil from "../util/null";
import {
  type Grain,
  format as formatGrain,
  ZERO,
  DECIMAL_PRECISION,
} from "./grain";
import {type DistributionV1} from "./distribution";

/**
 * Models a transfer of grain from a sender to recipient.
 * A grainholder may transfer grain to themself (which is a no-op).
 */
export type TransferV1 = {|
  +type: "TRANSFER",
  +version: number,
  +sender: NodeAddressT,
  +recipient: NodeAddressT,
  +amount: Grain,
  +timestampMs: number,
  +memo: string,
|};

export type LedgerEvent = DistributionV1 | TransferV1;

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
   */
  events(): $ReadOnlyArray<LedgerEvent>;
}

export function inMemoryLedger(events: $ReadOnlyArray<LedgerEvent>): Ledger {
  return new _InMemoryLedger(events);
}

class _InMemoryLedger implements Ledger {
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
      lastTimestamp = e.timestampMs;
      switch (e.type) {
        case "DISTRIBUTION":
          this._processDistribution((e: DistributionV1));
          break;
        case "TRANSFER":
          this._processTransfer((e: TransferV1));
          break;
        default:
          throw new Error(`Unsupported event type: ${(e.type: empty)}`);
      }
    }
  }

  events(): $ReadOnlyArray<LedgerEvent> {
    return [...this._events];
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

  _processDistribution(d: DistributionV1) {
    const {version, receipts} = d;
    if (version !== 1) {
      throw new Error(`Unsupported distribution version: ${version}`);
    }
    for (const {amount, address} of receipts) {
      const balance = this._balance(address) + amount;
      this._balances.set(address, balance);
      const earned = this._earning(address) + amount;
      this._earnings.set(address, earned);
    }
  }

  _processTransfer(t: TransferV1) {
    const {recipient, sender, amount, version, timestampMs} = t;
    if (version !== 1) {
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
