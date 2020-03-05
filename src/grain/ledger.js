// @flow

import deepFreeze from "deep-freeze";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import stringify from "json-stable-stringify";
import * as NullUtil from "../util/null";
import {type Grain, format as formatGrain} from "./grain";

export type LedgerEvent = Distribution | Transfer;

export opaque type OrderT = symbol;
export const Order: {|
  +ASCENDING: OrderT,
  +DESCENDING: OrderT,
|} = deepFreeze({
  ASCENDING: Symbol("ASCENDING"),
  DESCENDING: Symbol("DESCENDING"),
});

export type EventsOptions = {|
  +address: ?NodeAddressT,
  +order: ?OrderT,
|};

export type Transfer = {|
  +type: "TRANSFER",
  +sender: NodeAddressT,
  +recipient: NodeAddressT,
  +amount: Grain,
  +timestampMs: number,
|};

export type Distribution = {|
  +type: "DISTRIBUTION",
  +recipient: NodeAddressT,
  +amount: Grain,
  +timestampMs: number,
|};

export type AliasSpec = {|
  +canonical: NodeAddressT,
  +alias: NodeAddressT,
|};

export type LedgerHistory = {|
  +events: $ReadOnlyArray<LedgerEvent>,
  +aliases: Map<NodeAddressT, NodeAddressT>,
|};

export interface Ledger {
  balances(): Map<NodeAddressT, Grain>;
  earnings(): Map<NodeAddressT, Grain>;
  events(EventsOptions): $ReadOnlyArray<LedgerEvent>;
  history(): LedgerHistory;
}

// $ExpectFlowError
const zero: Grain = 0n;

export class InMemoryLedger implements Ledger {
  _balances: Map<NodeAddressT, Grain>;
  _earnings: Map<NodeAddressT, Grain>;
  _history: LedgerHistory;

  constructor(history: LedgerHistory) {
    this._history = history;
    this._balances = new Map();
    this._earnings = new Map();
    let lastTimestamp = -Infinity;
    for (const e of history.events) {
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
          throw new Error((e.type: empty));
      }
    }
  }

  events(opts: EventsOptions): $ReadOnlyArray<LedgerEvent> {
    let filter = (_) => true;
    if (opts.address) {
      filter = (x: LedgerEvent) => {
        switch (x.type) {
          case "DISTRIBUTION":
            return x.recipient === opts.address;
          case "TRANSFER":
            return x.recipient === opts.address || x.sender === opts.address;
          default:
            throw new Error((x.type: empty));
        }
      };
    }
    const events = this._history.events.filter(filter);
    if (opts.order === Order.DESCENDING) {
      events.reverse();
    }
    return events;
  }

  history() {
    return this._history;
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

  canonicalAddress(a: NodeAddressT): NodeAddressT {
    return NullUtil.orElse(this._history.aliases.get(a), a);
  }

  _processDistribution(d: Distribution) {
    const recipient = this.canonicalAddress(d.recipient);
    const balance = this._balance(recipient) + d.amount;
    this._balances.set(recipient, balance);
    const earned = NullUtil.orElse(this._earnings.get(recipient), zero);
    this._earnings.set(recipient, earned + d.amount);
  }

  _processTransfer(t: Transfer) {
    const recipient = this.canonicalAddress(t.recipient);
    const sender = this.canonicalAddress(t.sender);
    const recipientBalance = this._balance(recipient);
    const senderBalance = this._balance(sender);
    if (senderBalance < t.amount) {
      const forDisplay = {
        amount: formatGrain(t.amount, 18),
        recipient: NodeAddress.toString(t.recipient),
        sender: NodeAddress.toString(t.sender),
        timestampMs: t.timestampMs,
      };
      throw new Error(
        `Invalid transfer (sender can't afford): ${stringify(forDisplay)}`
      );
    }
    this._balances.set(recipient, recipientBalance + t.amount);
    this._balances.set(sender, senderBalance - t.amount);
  }
}
