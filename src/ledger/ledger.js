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
  identityAddress,
  identityNameFromString,
  identityNameParser,
} from "./identity";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import {type TimestampMs} from "../util/timestamp";
import * as NullUtil from "../util/null";
import {random as randomUuid, parser as uuidParser} from "../util/uuid";
import {
  type DistributionPolicy,
  computeDistribution,
  type CredHistory,
  type Distribution,
  distributionParser,
} from "./grainAllocation";
import * as G from "./grain";
import {JsonLog} from "../util/jsonLog";
import * as C from "../util/combo";

/**
 * An GrainAccount is an address that is present in the Ledger
 * and has some associated Grain.
 */
type MutableGrainAccount = {|
  +address: NodeAddressT,
  +identityId: IdentityId | null,
  balance: G.Grain,
  paid: G.Grain,
|};

export type GrainAccount = $ReadOnly<MutableGrainAccount>;

/**
 * The ledger for storing identity changes and (eventually) Grain distributions.
 *
 * The following API methods change the ledger state:
 * - `createIdentity`
 * - `renameIdentity`
 * - `addAlias`
 * - `removeAlias`
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
  _identities: Map<IdentityId, Identity>;
  _identityNameToId: Map<IdentityName, IdentityId>;
  _aliases: Map<NodeAddressT, IdentityId>;
  _accounts: Map<NodeAddressT, MutableGrainAccount>;
  _latestTimestamp: TimestampMs = -Infinity;

  constructor() {
    this._ledgerEventLog = new JsonLog();
    this._identities = new Map();
    this._identityNameToId = new Map();
    this._aliases = new Map();
    this._accounts = new Map();
  }

  /**
   * Return all the GrainAccounts in the ledger.
   */
  accounts(): $ReadOnlyArray<GrainAccount> {
    return Array.from(this._accounts.values());
  }

  /**
   * Get the GrainAccount associated with a particular address.
   *
   * If the address is associated with a identity, that identity's account is returned.
   * If the address is not associated with a identity, but has received Grain in
   * the past, then an alias-style account is returned (no identityId set).
   * If the address hasn't been encountered, we return undefined.
   */
  accountByAddress(address: NodeAddressT): ?GrainAccount {
    return this._accounts.get(this.canonicalAddress(address));
  }

  /**
   * Return all of the Identities in the Ledger.
   */
  identities(): $ReadOnlyArray<Identity> {
    return Array.from(this._identities.values());
  }

  /**
   * Return the Identity matching given id, or undefined if no identity
   * matches the id.
   */
  identityById(id: IdentityId): ?Identity {
    return this._identities.get(id);
  }

  /**
   * Return the Identity matching given identityName, or undefined
   * if no identity matches the identityName.
   *
   * Throws if the name provided is invalid.
   */
  identityByIdentityName(name: string): ?Identity {
    const identityName = identityNameFromString(name);
    const id = this._identityNameToId.get(identityName);
    if (id != null) {
      return this._identities.get(id);
    }
  }

  /**
   * Get some address's "canoncial" address.
   *
   * If the address is the alias of some identity, then
   * the identity's innate address is caanonical. Otherwise,
   * the address is itself canonical.
   */
  canonicalAddress(address: NodeAddressT): NodeAddressT {
    const identityId = this._aliases.get(address);
    if (identityId != null) {
      return identityAddress(identityId);
    }
    return address;
  }

  /**
   * Create a Identity in the ledger.
   *
   * This will reserve the identity's identityName, and its innate address.
   *
   * This returns the newly created Identity's ID, so that the caller
   * store it for future reference.
   *
   * Will fail if the identityName is not valid, or already taken.
   */
  createIdentity(name: string): IdentityId {
    const identityName = identityNameFromString(name);
    const action = {
      type: "CREATE_IDENTITY",
      identityId: randomUuid(),
      identityName,
      version: "1",
    };
    this._createAndProcessEvent(action);
    return NullUtil.get(this._identityNameToId.get(identityName));
  }
  _createIdentity({identityName, identityId}: CreateIdentity) {
    if (this._identityNameToId.has(identityName)) {
      // This identity already exists; return.
      throw new Error(
        `createIdentity: identityName already taken: ${identityName}`
      );
    }
    // istanbul ignore if
    if (this._aliases.has(identityAddress(identityId))) {
      // This should never happen, as it implies a UUID conflict.
      throw new Error(
        `createIdentity: innate address already claimed ${identityId}`
      );
    }
    const addr = identityAddress(identityId);

    // Mutations! Method must not fail after this comment.
    this._identityNameToId.set(identityName, identityId);
    this._identities.set(identityId, {
      name: identityName,
      id: identityId,
      aliases: [],
    });
    // Reserve this identity's own address
    this._aliases.set(addr, identityId);
    // Every identity has a corresponding GrainAccount.
    this._accounts.set(addr, {
      balance: G.ZERO,
      paid: G.ZERO,
      address: addr,
      identityId,
    });
  }

  /**
   * Change a identity's identityName.
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
    const existingIdentity = this._identities.get(identityId);
    if (existingIdentity == null) {
      throw new Error(`renameIdentity: no identity matches id ${identityId}`);
    }
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
      aliases: existingIdentity.aliases,
    };

    // Mutations! Method must not fail after this comment.
    this._identityNameToId.delete(existingIdentity.name);
    this._identityNameToId.set(newName, identityId);
    this._identities.set(identityId, updatedIdentity);
  }

  /**
   * Add an alias for a identity.
   *
   * If the alias has a Grain balance, then this will emit two events: first,
   * one adding the alias, and a followup transferring the alias's Grain
   * balance to the canonical identity.
   *
   * We explicitly emit two events (rather than including the balance transfer
   * as a part of the alias action) to improve audit-ability, and make it
   * easier to undo accidental or fraudulent linking.
   *
   * Will no-op if the identity already has that alias.
   * Will fail if the identity does not exist.
   * Will fail if the alias is already claimed, or if it is
   * another identity's innate address.
   *
   * Careful! This method may emit two_ events. Care must be taken to ensure
   * that it cannot fail after it has emitted the first event. That means we
   * must explicitly check all of the possible failure modes of the second
   * event. Otherwise, we risk leaving the ledger in an inadvertently
   * half-updated state, where the first event has been processed but the
   * second one failed.
   */
  addAlias(identityId: IdentityId, alias: NodeAddressT): Ledger {
    // Ensure that if we emit two events, they both have the
    // same timestamp.
    const ledgerTimestamp = _getTimestamp();

    // Validate the ADD_ALIAS action so it cannot fail after we have
    // already emitted the account transfer
    const aliasAction: AddAlias = {
      type: "ADD_ALIAS",
      identityId,
      alias,
      version: "1",
    };
    this._validateAddAlias(aliasAction);
    const aliasEvent: LedgerEvent = {
      action: aliasAction,
      ledgerTimestamp,
      version: "1",
    };

    // If the alias had some grain, explicitly transfer it to the new account.
    const aliasAccount = this._getAccount(alias);
    if (aliasAccount.balance !== G.ZERO) {
      // The method may not fail below this line
      const transferAction = {
        from: alias,
        to: identityAddress(identityId),
        amount: aliasAccount.balance,
        memo: "transfer from alias to canonical account",
        type: "TRANSFER_GRAIN",
        version: "1",
      };
      const transferEvent = {
        action: transferAction,
        ledgerTimestamp,
        version: "1",
      };
      this._processEvent(transferEvent);
    }
    this._processEvent(aliasEvent);
    return this;
  }
  _validateAddAlias({identityId, alias}: AddAlias) {
    const existingIdentity = this._identities.get(identityId);
    if (existingIdentity == null) {
      throw new Error(`addAlias: no matching identityId ${identityId}`);
    }
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
    // Just a convenience, since we already verified it exists; we'll
    // make it available to _addAlias.
    // Makes it more obvious that _addAlias can't fail due to the existingIdentity
    // being null.
    return existingIdentity;
  }
  /**
   * The ADD_ALIAS action may get emitted after a TRANSFER_GRAIN event
   * that is part of the same transaction. As such, it should never fail
   * outside of the _validateAddAlias method (which is checked before
   * emitting the TRANSFER_GRAIN action).
   */
  _addAlias(action: AddAlias) {
    const existingIdentity = this._validateAddAlias(action);
    const {identityId, alias} = action;
    const aliasAccount = this._getAccount(alias);

    this._aliases.set(alias, identityId);
    const updatedAliases = existingIdentity.aliases.slice();
    updatedAliases.push(alias);
    const updatedIdentity = {
      id: existingIdentity.id,
      name: existingIdentity.name,
      aliases: updatedAliases,
    };
    const addr = identityAddress(identityId);
    const identityAccount = this._unsafeGetAccount(addr);

    this._identities.set(identityId, updatedIdentity);
    // Transfer the alias's history of getting paid to the identity account.
    // This is necessary since the BALANCED payout policy takes
    // identities' lifetime of cred distributions into account.
    identityAccount.paid = G.add(identityAccount.paid, aliasAccount.paid);
    // Assuming the event was added using the API, this balance will have
    // already been explicitly transferred. However, just for good measure
    // and robustness to future changes, we add this anyway, so that there
    // will never be "vanishing Grain" when the alias account is deleted.
    identityAccount.balance = G.add(
      identityAccount.balance,
      aliasAccount.balance
    );
    this._accounts.delete(alias);
  }

  /**
   * Remove an alias from a identity.
   *
   * In order to safely remove an alias, we need to know what proportion of
   * that identity's Cred came from this alias. That way, we can re-allocate an
   * appropriate share of the identity's lifetime grain receipts to the alias they
   * are disconnecting from. Otherwise, it would be possible for the identity to
   * game the BALANCED allocation strategy by strategically linking and
   * unlinking aliases.
   *
   * When an alias is removed, none of the identity's current Grain balance goes
   * back to that alias.
   *
   * If the alias was linked fraudulently (someone claimed another person's
   * account), then remedial action may be appropriate, e.g. transferring the
   * fraudster's own Grain back to the account they tried to steal from.
   *
   * Will no-op if the identity doesn't have that alias.
   *
   * Will fail if the identity does not exist.
   *
   * Will fail if the alias is in fact the identity's innate address.
   */
  removeAlias(
    identityId: IdentityId,
    alias: NodeAddressT,
    credProportion: number
  ): Ledger {
    if (credProportion < 0 || credProportion > 1 || !isFinite(credProportion)) {
      throw new Error(`removeAlias: invalid credProportion ${credProportion}`);
    }
    const paid = this._getAccount(alias).paid;
    const retroactivePaid = G.multiplyFloat(paid, credProportion);

    this._createAndProcessEvent({
      type: "REMOVE_ALIAS",
      identityId,
      alias,
      version: "1",
      retroactivePaid,
    });
    return this;
  }
  _removeAlias({identityId, alias, retroactivePaid}: RemoveAlias) {
    const existingIdentity = this._identities.get(identityId);
    if (existingIdentity == null) {
      throw new Error(`removeAlias: no identity matching id ${identityId}`);
    }
    if (alias === identityAddress(identityId)) {
      throw new Error(`removeAlias: cannot remove identity's innate address`);
    }
    const existingAliases = existingIdentity.aliases;
    const idx = existingAliases.indexOf(alias);
    if (idx === -1) {
      throw new Error(
        `removeAlias: identity does not have alias: ${
          existingIdentity.name
        }, ${NodeAddress.toString(alias)}`
      );
    }
    const aliases = existingAliases.slice();
    aliases.splice(idx, 1);

    // State mutations! Method must not fail past this comment.
    const identityAccount = this._unsafeGetAccount(alias);
    this._aliases.delete(alias);
    this._identities.set(identityId, {
      id: identityId,
      name: existingIdentity.name,
      aliases,
    });
    if (retroactivePaid !== G.ZERO) {
      identityAccount.paid = G.sub(identityAccount.paid, retroactivePaid);
      // Create a new alias account to hold onto our retroactivePaid amount
      this._unsafeGetAccount(alias).paid = retroactivePaid;
    }
  }

  /**
   * Distribute Grain given allocation policies, and the Cred history.
   *
   * The order of the policies will not have any affect on the distribution.
   * See logic and types in `ledger/grainAllocation.js`.
   *
   * TODO: Consider refactoring this method to take the Distribution directly,
   * rather than computing it inline. In that case, we can make a public
   * endpoint for retrieving the paidMap. This refcator changes the programming
   * interface but not the serialized Ledger type, so it's not urgent, but
   * it might be a little cleaner.
   */
  distributeGrain(
    policies: $ReadOnlyArray<DistributionPolicy>,
    credHistory: CredHistory
  ): Ledger {
    const paidMap = this._computePaidMap(credHistory);

    const distribution = computeDistribution(policies, credHistory, paidMap);
    this._createAndProcessEvent({
      type: "DISTRIBUTE_GRAIN",
      version: "1",
      distribution,
    });
    return this;
  }
  _distributeGrain({distribution}: DistributeGrain) {
    // Mutation ahead: This method may not fail after this comment
    for (const {receipts} of distribution.allocations) {
      for (const {address, amount} of receipts) {
        this._allocateGrain(address, amount);
      }
    }
  }

  /**
   * Transfer Grain from one account to another.
   *
   * Fails if the sender does not have enough Grain, or if the Grain amount is negative.
   * Self-transfers are supported.
   * An optional memo may be added.
   *
   * Note: The arguments need to be bundled together in an object with named
   * keys, to avoid getting confused about which positional argument is `from`
   * and which one is `to`.
   */
  transferGrain(opts: {|
    from: NodeAddressT,
    to: NodeAddressT,
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
    const fromAccount = this._getAccount(from);
    if (G.lt(amount, G.ZERO)) {
      throw new Error(`cannot transfer negative Grain amount: ${amount}`);
    }
    if (G.gt(amount, fromAccount.balance)) {
      throw new Error(
        `transferGrain: ${NodeAddress.toString(
          from
        )} has insufficient balance for transfer: ${amount} > ${
          fromAccount.balance
        }`
      );
    }

    // Mutation ahead: May not fail after this comment
    // Ensure that both fromAccount and toAccount exist, by calling _unsafeGetAccount
    const toAccount = this._unsafeGetAccount(to);
    this._unsafeGetAccount(from);
    fromAccount.balance = G.sub(fromAccount.balance, amount);
    toAccount.balance = G.add(toAccount.balance, amount);
  }

  /**
   * For a CredHistory, create a map showing how much every address in the history
   * has been paid.
   *
   * The CredHistory should have been computed using the Ledger's existing set
   * of Identities and aliases, which means no alias should be present in the
   * CredHistory. This is important so we can compute BALANCED allocations
   * properly. If this invariant is violated, we throw an error.
   */
  _computePaidMap(history: CredHistory): Map<NodeAddressT, G.Grain> {
    const credAddresses = new Set();
    for (const {cred} of history) {
      for (const address of cred.keys()) {
        credAddresses.add(address);
      }
    }
    const paidMap = new Map();
    for (const address of credAddresses) {
      if (this.canonicalAddress(address) !== address) {
        const account = NullUtil.get(this.accountByAddress(address));
        const identityId = NullUtil.get(account.identityId);
        const identity = NullUtil.get(this.identityById(identityId));
        throw new Error(
          `distributeGrain: non-canonical address in credHistory: ${NodeAddress.toString(
            address
          )} (alias of ${identity.name})`
        );
      }
      const {paid} = this._getAccount(address);
      paidMap.set(address, paid);
    }
    return paidMap;
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
      case "REMOVE_ALIAS":
        this._removeAlias(action);
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
  _allocateGrain(recipient: NodeAddressT, amount: G.Grain) {
    const canonical = this.canonicalAddress(recipient);
    const account = this._unsafeGetAccount(canonical);
    account.paid = G.add(amount, account.paid);
    account.balance = G.add(amount, account.balance);
  }

  /**
   * Get an account for this address, returning an empty alias-style
   * account if it's not found.
   *
   * This does not add the account to state, so it's safe to use in the non-mutating
   * parts of the ledger.
   */
  _getAccount(addr: NodeAddressT) {
    const canonical = this.canonicalAddress(addr);
    const existingAccount = this._accounts.get(canonical);
    if (existingAccount == null) {
      return {
        address: canonical,
        balance: G.ZERO,
        paid: G.ZERO,
        identityId: null,
      };
    } else {
      return existingAccount;
    }
  }

  /**
   * Get an account for this address, returning an empty alias-style account if it's not
   * found. If no account was found, it will also set the account, which makes this
   * mutating & unsafe.
   */
  _unsafeGetAccount(addr: NodeAddressT) {
    const canonical = this.canonicalAddress(addr);
    const account = this._getAccount(addr);
    if (!this._accounts.has(canonical)) {
      this._accounts.set(canonical, account);
    }
    return account;
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
  | RemoveAlias
  | DistributeGrain
  | TransferGrain;

type CreateIdentity = {|
  +type: "CREATE_IDENTITY",
  +version: "1",
  +identityName: IdentityName,
  +identityId: IdentityId,
|};
const createIdentityParser: C.Parser<CreateIdentity> = C.object({
  type: C.exactly(["CREATE_IDENTITY"]),
  version: C.exactly(["1"]),
  identityName: identityNameParser,
  identityId: uuidParser,
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

type RemoveAlias = {|
  +type: "REMOVE_ALIAS",
  +identityId: IdentityId,
  +alias: NodeAddressT,
  +version: "1",
  +retroactivePaid: G.Grain,
|};
const removeAliasParser: C.Parser<RemoveAlias> = C.object({
  type: C.exactly(["REMOVE_ALIAS"]),
  version: C.exactly(["1"]),
  identityId: uuidParser,
  alias: NodeAddress.parser,
  retroactivePaid: G.parser,
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
  +from: NodeAddressT,
  +to: NodeAddressT,
  +amount: G.Grain,
  +memo: string | null,
|};
const transferGrainParser: C.Parser<TransferGrain> = C.object({
  type: C.exactly(["TRANSFER_GRAIN"]),
  version: C.exactly(["1"]),
  from: NodeAddress.parser,
  to: NodeAddress.parser,
  amount: G.parser,
  memo: C.orElse([C.string, C.null_]),
});

const actionParser: C.Parser<Action> = C.orElse([
  createIdentityParser,
  renameIdentityParser,
  addAliasParser,
  removeAliasParser,
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
