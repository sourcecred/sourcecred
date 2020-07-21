// @flow

/**
 * This module contains the ledger, for accumulating state updates related to
 * identity identities and Grain distribution.
 *
 * A key requirement for the ledger is that we need to store an ordered log of
 * every action that's happened in the ledger, so that we can audit the ledger
 * state to ensure its integrity.
 */
import {
  type IdentityId,
  type Identity,
  type IdentityName,
  type IdentitySubtype,
  identityParser,
  newIdentity,
  identityNameParser,
  identityNameFromString,
} from "./identity";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import {type TimestampMs} from "../util/timestamp";
import * as NullUtil from "../util/null";
import {parser as uuidParser} from "../util/uuid";
import {type Distribution, parser as distributionParser} from "./distribution";
import * as G from "./grain";
import {JsonLog} from "../util/jsonLog";
import * as C from "../util/combo";

/**
 * Every Identity in the ledger has an Account.
 */
type MutableAccount = {|
  identity: Identity,
  // The current Grain balance of this account
  balance: G.Grain,
  // The amount of Grain this account has received in past Distributions
  paid: G.Grain,
  // Whether or not the account is currently "active". An inactive account
  // may not receive or transfer Grain. Accounts start inactive, and must
  // be explicitly activated.
  active: boolean,
|};
export type Account = $ReadOnly<MutableAccount>;

/**
 * The Ledger is an append-only auditable data store which tracks
 * - Identities and what aliases they possess
 * - Identities' grain balances
 *
 * Every time the ledger state is changed, a corresponding Action is added to
 * the ledger's action log. The ledger state may be serialized by saving the
 * action log, and then reconstructed by replaying the action log. The
 * corresponding methods are `actionLog` and `Ledger.fromActionLog`.
 *
 * None of these methods are idempotent, since they all modify the Ledger state
 * on success by adding a new action to the log. Therefore, they will all fail
 * if they would not cause any change to the ledger's logical state, so as to
 * prevent the ledger from permanently accumulating no-op clutter in the log.
 *
 * It's important that any API method that fails (e.g. trying to add a
 * conflicting identity) fails without mutating the ledger state; this way we avoid
 * ever getting the ledger in a corrupted state. To make this easier to test,
 * the test code uses deep equality testing on the ledger before/after
 * attempting illegal actions. To ensure that this testing works, we should
 * avoid adding any ledger state that can't be verified by deep equality
 * checking (e.g. don't store state in functions or closures that aren't
 * attached to the Ledger object).
 *
 * Every Ledger action has a timestamp, and the Ledger's actions must always be
 * in timestamp-sorted order. Adding a new Action with a timestamp older than a
 * previous action is illegal.
 */
export class Ledger {
  _ledgerEventLog: JsonLog<LedgerEvent>;
  _identityNameToId: Map<IdentityName, IdentityId>;
  _aliases: Map<NodeAddressT, IdentityId>;
  _accounts: Map<IdentityId, MutableAccount>;
  _latestTimestamp: TimestampMs = -Infinity;
  _lastDistributionTimestamp: TimestampMs = -Infinity;

  constructor() {
    this._ledgerEventLog = new JsonLog();
    this._identityNameToId = new Map();
    this._aliases = new Map();
    this._accounts = new Map();
  }

  /**
   * Return all the Accounts in the ledger.
   */
  accounts(): $ReadOnlyArray<Account> {
    return Array.from(this._accounts.values());
  }

  /**
   * Get the Account associated with a particular identity.
   *
   * If the identity is not in the ledger, an error is thrown.
   */
  account(id: IdentityId): Account {
    // This wrapper ensures it's a read-only type
    return this._mutableAccount(id);
  }

  _mutableAccount(id: IdentityId): MutableAccount {
    const result = this._accounts.get(id);
    if (result == null) {
      throw new Error(`no Account for identity: ${id}`);
    }
    return result;
  }

  /**
   * Create an account in the ledger.
   *
   * This will reserve the identity's identityName, and its innate address.
   *
   * This returns the newly created Identity's ID, so that the caller
   * store it for future reference.
   *
   * Will fail if the identityName is not valid, or already taken.
   */
  createIdentity(subtype: IdentitySubtype, name: string): IdentityId {
    const identity = newIdentity(subtype, name);
    const action = {
      type: "CREATE_IDENTITY",
      identity,
      version: "1",
    };
    this._createAndProcessEvent(action);
    return NullUtil.get(this._identityNameToId.get(identity.name));
  }
  _createIdentity({identity}: CreateIdentity) {
    if (this._identityNameToId.has(identity.name)) {
      // This identity already exists; return.
      throw new Error(
        `createIdentity: identityName already taken: ${identity.name}`
      );
    }
    if (identity.aliases.length !== 0) {
      throw new Error(`createIdentity: new identities may not have aliases`);
    }
    // istanbul ignore if
    if (this._aliases.has(identity.address)) {
      // This should never happen, as it implies a UUID conflict.
      throw new Error(
        `createIdentity: innate address already claimed ${identity.id}`
      );
    }

    // Mutations! Method must not fail after this comment.
    this._identityNameToId.set(identity.name, identity.id);
    // Reserve this identity's own address
    this._aliases.set(identity.address, identity.id);
    // Every identity has a corresponding Account.
    this._accounts.set(identity.id, {
      balance: G.ZERO,
      paid: G.ZERO,
      identity,
      active: false,
    });
  }

  /**
   * Change a identity's name.
   *
   * Will fail if no identity matches the identityId, or if the identity already has that
   * name, or if the identity's new name is claimed by another identity.
   */
  renameIdentity(identityId: IdentityId, newName: string): Ledger {
    this._createAndProcessEvent({
      type: "RENAME_IDENTITY",
      identityId,
      newName: identityNameFromString(newName),
      version: "1",
    });
    return this;
  }
  _renameIdentity({identityId, newName}: RenameIdentity) {
    if (!this._accounts.has(identityId)) {
      throw new Error(`renameIdentity: no identity matches id ${identityId}`);
    }
    const account = this._mutableAccount(identityId);
    const existingIdentity = account.identity;
    if (existingIdentity.name === newName) {
      // We error rather than silently succeed because we don't want the ledger
      // to get polluted with no-op records (no successful operations are
      // idempotent, since they do add to the ledger logs)
      throw new Error(`renameIdentity: identity already has name ${newName}`);
    }
    if (this._identityNameToId.has(newName)) {
      // We already checked that the name is not owned by this identity,
      // so it is a conflict. Fail.
      throw new Error(`renameIdentity: conflict on identityName ${newName}`);
    }
    const updatedIdentity = {
      id: identityId,
      name: newName,
      subtype: existingIdentity.subtype,
      address: existingIdentity.address,
      aliases: existingIdentity.aliases,
    };

    // Mutations! Method must not fail after this comment.
    this._identityNameToId.delete(existingIdentity.name);
    this._identityNameToId.set(newName, identityId);
    account.identity = updatedIdentity;
  }

  /**
   * Add an alias for a identity.
   *
   * If that alias is associated with past Grain payments (because it
   * was unlinked from another identity), those past Grain payments will be
   * associated with the newly linked identity.
   *
   * Will fail if the identity does not exist.
   * Will fail if the alias is already claimed by any identity.
   */
  addAlias(identityId: IdentityId, alias: NodeAddressT): Ledger {
    this._createAndProcessEvent({
      type: "ADD_ALIAS",
      identityId,
      alias,
      version: "1",
    });
    return this;
  }
  _addAlias({identityId, alias}: AddAlias) {
    if (!this._accounts.has(identityId)) {
      throw new Error(`addAlias: no identity matches id ${identityId}`);
    }
    const account = this._mutableAccount(identityId);
    const existingIdentity = account.identity;
    const existingAliases = existingIdentity.aliases;
    if (existingAliases.indexOf(alias) !== -1) {
      throw new Error(
        `addAlias: identity already has alias: ${
          existingIdentity.name
        }, ${NodeAddress.toString(alias)}`
      );
    }
    if (this._aliases.has(alias)) {
      // Some other identity has this alias; fail.
      throw new Error(
        `addAlias: alias ${NodeAddress.toString(alias)} already bound`
      );
    }

    // Mutations below; method must not fail after this line.
    this._aliases.set(alias, identityId);
    const updatedAliases = existingIdentity.aliases.slice();
    updatedAliases.push(alias);
    const updatedIdentity = {
      id: existingIdentity.id,
      name: existingIdentity.name,
      subtype: existingIdentity.subtype,
      aliases: updatedAliases,
      address: existingIdentity.address,
    };
    account.identity = updatedIdentity;
  }

  /**
   * Activate an account, making it eligible to send and recieve Grain.
   *
   * If the account is already active, this will no-op (without emitting any
   * event).
   */
  activate(id: IdentityId): Ledger {
    if (!this._accounts.has(id)) {
      throw new Error(`identity ${id} not found`);
    }
    const {active} = this.account(id);
    if (active) {
      // no-op; account already active
      return this;
    } else {
      this._createAndProcessEvent({
        type: "TOGGLE_ACTIVATION",
        version: "1",
        identityId: id,
      });
      return this;
    }
  }

  /**
   * Deactivate an account, making it ineligible to send or recieve Grain.
   *
   * The account's Grain balance will remain untouched until it is reactivated.
   *
   * If the account is already inactive, this will no-op (without emitting any
   * event).
   */
  deactivate(id: IdentityId): Ledger {
    if (!this._accounts.has(id)) {
      throw new Error(`identity ${id} not found`);
    }
    const {active} = this.account(id);
    if (active) {
      this._createAndProcessEvent({
        type: "TOGGLE_ACTIVATION",
        version: "1",
        identityId: id,
      });
      return this;
    } else {
      // no-op; account already inactive
      return this;
    }
  }
  _toggleActivation({identityId}: ToggleActivation) {
    const account = this._mutableAccount(identityId);
    // Cannot fail below this line.
    account.active = !account.active;
  }

  /**
   * Canonicalize a Grain distribution in the ledger.
   *
   * Fails if any of the recipients are not active.
   */
  distributeGrain(distribution: Distribution): Ledger {
    this._createAndProcessEvent({
      type: "DISTRIBUTE_GRAIN",
      version: "1",
      distribution,
    });
    return this;
  }
  _distributeGrain({distribution}: DistributeGrain) {
    for (const {receipts} of distribution.allocations) {
      for (const {id, amount} of receipts) {
        if (!this._accounts.has(id)) {
          throw new Error(`cannot distribute; invalid id ${id}`);
        }
        if (G.lt(amount, G.ZERO)) {
          throw new Error(`negative Grain amount: ${amount}`);
        }
        const {active} = this.account(id);
        if (!active) {
          throw new Error(`attempt to distribute to inactive account: ${id}`);
        }
      }
    }
    // Mutations beckon: method must not fail after this comment
    for (const {receipts} of distribution.allocations) {
      for (const {id, amount} of receipts) {
        this._allocateGrain(id, amount);
      }
    }
    if (distribution.credTimestamp > this._lastDistributionTimestamp) {
      this._lastDistributionTimestamp = distribution.credTimestamp;
    }
  }

  /**
   * Transfer Grain from one account to another.
   *
   * Fails if the sender does not have enough Grain, or if the Grain amount is
   * negative.
   * Fails if either the sender or the receipient have not been activated.
   * Self-transfers are supported.
   * An optional memo may be added.
   *
   * Note: The arguments need to be bundled together in an object with named
   * keys, to avoid getting confused about which positional argument is `from`
   * and which one is `to`.
   */
  transferGrain(opts: {|
    from: IdentityId,
    to: IdentityId,
    amount: G.Grain,
    memo: string | null,
  |}) {
    const {from, to, amount, memo} = opts;
    this._createAndProcessEvent({
      from,
      to,
      amount,
      memo,
      type: "TRANSFER_GRAIN",
      version: "1",
    });
    return this;
  }
  _transferGrain({from, to, amount}: TransferGrain) {
    if (!this._accounts.has(from)) {
      throw new Error(`invalid sender: ${from}`);
    }
    if (!this._accounts.has(to)) {
      throw new Error(`invalid recipient: ${to}`);
    }
    const fromAccount = this._mutableAccount(from);
    const toAccount = this._mutableAccount(to);
    if (!fromAccount.active) {
      throw new Error(`transfer from inactive account: ${from}`);
    }
    if (!toAccount.active) {
      throw new Error(`transfer to inactive account: ${to}`);
    }
    if (G.lt(amount, G.ZERO)) {
      throw new Error(`cannot transfer negative Grain amount: ${amount}`);
    }
    if (G.gt(amount, fromAccount.balance)) {
      throw new Error(
        `transferGrain: ${from} has insufficient balance for transfer: ${amount} > ${fromAccount.balance}`
      );
    }

    // Mutation ahead: May not fail after this comment
    fromAccount.balance = G.sub(fromAccount.balance, amount);
    toAccount.balance = G.add(toAccount.balance, amount);
  }

  /**
   * Retrieve the log of all actions in the Ledger's history.
   *
   * May be used to reconstruct the Ledger after serialization.
   */
  eventLog(): LedgerLog {
    return Array.from(this._ledgerEventLog.values());
  }

  /**
   * Reconstruct a Ledger from a LedgerLog.
   */
  static fromEventLog(log: LedgerLog): Ledger {
    const ledger = new Ledger();
    for (const e of log) {
      ledger._processEvent(e);
    }
    return ledger;
  }

  /**
   * Serialize the events as a JsonLog-style string.
   *
   * Will be a valid JSON string formatted so as to
   * have one action per line.
   */
  serialize(): string {
    return this._ledgerEventLog.toString();
  }

  /**
   * Return the cred-effective timestamp for the last Grain distribution.
   *
   * We provide this because we may want to have a policy that issues one
   * distribution for each interval in the history of the project.
   */
  lastDistributionTimestamp(): TimestampMs {
    return this._lastDistributionTimestamp;
  }

  _processAction(action: Action) {
    switch (action.type) {
      case "CREATE_IDENTITY":
        this._createIdentity(action);
        break;
      case "RENAME_IDENTITY":
        this._renameIdentity(action);
        break;
      case "ADD_ALIAS":
        this._addAlias(action);
        break;
      case "TOGGLE_ACTIVATION":
        this._toggleActivation(action);
        break;
      case "DISTRIBUTE_GRAIN":
        this._distributeGrain(action);
        break;
      case "TRANSFER_GRAIN":
        this._transferGrain(action);
        break;
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error(`Unknown type: ${(action.type: empty)}`);
    }
  }

  _processEvent(e: LedgerEvent) {
    const {action, ledgerTimestamp} = e;
    if (ledgerTimestamp == null || !isFinite(ledgerTimestamp)) {
      throw new Error(`ledger: invalid timestamp ${ledgerTimestamp}`);
    }
    if (ledgerTimestamp < this._latestTimestamp) {
      throw new Error(
        `ledger: out-of-order timestamp: ${ledgerTimestamp} < ${this._latestTimestamp}`
      );
    }
    this._processAction(action);
    this._latestTimestamp = ledgerTimestamp;
    this._ledgerEventLog.append([e]);
  }

  _createAndProcessEvent(action: Action) {
    const ledgerTimestamp = _getTimestamp();
    const ledgerEvent = {ledgerTimestamp, action, version: "1"};
    this._processEvent(ledgerEvent);
  }

  // Helper method for recording that Grain was allocated to a identity.
  // Increases the identity's paid amount and balance in sync.
  _allocateGrain(recipient: IdentityId, amount: G.Grain) {
    const account = this._mutableAccount(recipient);
    account.paid = G.add(amount, account.paid);
    account.balance = G.add(amount, account.balance);
  }
}

/**
 * The log of all Actions in the Ledger.
 *
 * This is an opaque type; clients must not modify the log, since they
 * could put it in an inconsistent state.
 */
export opaque type LedgerLog = $ReadOnlyArray<LedgerEvent>;

type LedgerEvent = {|
  +action: Action,
  +ledgerTimestamp: TimestampMs,
  +version: "1",
|};

/**
 * The Actions are used to store the history of Ledger changes.
 */
type Action =
  | CreateIdentity
  | RenameIdentity
  | AddAlias
  | ToggleActivation
  | DistributeGrain
  | TransferGrain;

type CreateIdentity = {|
  +type: "CREATE_IDENTITY",
  +version: "1",
  +identity: Identity,
|};
const createIdentityParser: C.Parser<CreateIdentity> = C.object({
  type: C.exactly(["CREATE_IDENTITY"]),
  version: C.exactly(["1"]),
  identity: identityParser,
});

type RenameIdentity = {|
  +type: "RENAME_IDENTITY",
  +version: "1",
  +identityId: IdentityId,
  +newName: IdentityName,
|};
const renameIdentityParser: C.Parser<RenameIdentity> = C.object({
  type: C.exactly(["RENAME_IDENTITY"]),
  version: C.exactly(["1"]),
  identityId: uuidParser,
  newName: identityNameParser,
});

type AddAlias = {|
  +type: "ADD_ALIAS",
  +version: "1",
  +identityId: IdentityId,
  +alias: NodeAddressT,
|};
const addAliasParser: C.Parser<AddAlias> = C.object({
  type: C.exactly(["ADD_ALIAS"]),
  version: C.exactly(["1"]),
  identityId: uuidParser,
  alias: NodeAddress.parser,
});

type ToggleActivation = {|
  +type: "TOGGLE_ACTIVATION",
  +version: "1",
  +identityId: IdentityId,
|};
const toggleActivationParser: C.Parser<ToggleActivation> = C.object({
  type: C.exactly(["TOGGLE_ACTIVATION"]),
  version: C.exactly(["1"]),
  identityId: uuidParser,
});

type DistributeGrain = {|
  +type: "DISTRIBUTE_GRAIN",
  +version: "1",
  +distribution: Distribution,
|};
const distributeGrainParser: C.Parser<DistributeGrain> = C.object({
  type: C.exactly(["DISTRIBUTE_GRAIN"]),
  version: C.exactly(["1"]),
  distribution: distributionParser,
});

type TransferGrain = {|
  +type: "TRANSFER_GRAIN",
  +version: "1",
  +from: IdentityId,
  +to: IdentityId,
  +amount: G.Grain,
  +memo: string | null,
|};
const transferGrainParser: C.Parser<TransferGrain> = C.object({
  type: C.exactly(["TRANSFER_GRAIN"]),
  version: C.exactly(["1"]),
  from: uuidParser,
  to: uuidParser,
  amount: G.parser,
  memo: C.orElse([C.string, C.null_]),
});

const actionParser: C.Parser<Action> = C.orElse([
  createIdentityParser,
  renameIdentityParser,
  addAliasParser,
  toggleActivationParser,
  distributeGrainParser,
  transferGrainParser,
]);

const ledgerEventParser: C.Parser<LedgerEvent> = C.object({
  action: actionParser,
  ledgerTimestamp: C.number,
  version: C.exactly(["1"]),
});

export const parser: C.Parser<Ledger> = C.fmap(
  C.array(ledgerEventParser),
  (x) => Ledger.fromEventLog(x)
);

const _getTimestamp = () => Date.now();
