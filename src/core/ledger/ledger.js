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
  type Name,
  type IdentityType,
  nameParser,
  nameFromString,
  type Alias,
  aliasParser,
  type Identity,
  newIdentity,
  identityParser,
  identityTypeParser,
} from "../identity";
import {
  type Currency,
  type ChainId,
  currencyParser,
  buildCurrency,
} from "./currency";
import {type NodeAddressT, NodeAddress} from "../graph";
import {type TimestampMs} from "../../util/timestamp";
import * as NullUtil from "../../util/null";
import * as uuid from "../../util/uuid";
import {
  type Distribution,
  type DistributionId,
  parser as distributionParser,
} from "./distribution";
import {
  ethAddressParser,
  type EthAddress,
} from "../../plugins/ethereum/ethAddress";
import * as G from "./grain";
import {JsonLog} from "../../util/jsonLog";
import * as C from "../../util/combo";
import {
  type Allocation,
  type AllocationId,
  type GrainReceipt,
} from "./grainAllocation";

/**
 * Timestamped record of a grain payment
 * made to an Identity from a specific Allocation.
 */
type AllocationReceipt = {|
  +allocationId: AllocationId,
  +grainReceipt: GrainReceipt,
  +credTimestampMs: TimestampMs,
|};

/**
 * Every Identity in the ledger has an Account.
 */
type MutableAccount = {|
  identity: Identity,
  // The current Grain balance of this account
  balance: G.Grain,
  // The amount of Grain this account has received in past Distributions
  paid: G.Grain,
  // A history of Grain allocations to the account in chronological order.
  // Includes allocations received directly and via identity merge.
  allocationHistory: Array<AllocationReceipt>,
  // Whether or not the account is currently "active". An inactive account
  // may not receive or transfer Grain. Accounts start inactive, and must
  // be explicitly activated.
  active: boolean,
  // key-value store of blockchain addresses the account receives grain to
  payoutAddresses: PayableAddressStore,
|};
export type Account = $ReadOnly<MutableAccount>;

/**
 * The Currency key must be stringified to ensure the data is retrievable.
 * Keying on the raw Currency object means keying on the object reference,
 * rather than the contents of the object.
 */
type CurrencyId = string;

// Only Eth Addresses are supported at the moment
type PayoutAddress = EthAddress;

/**
 * PayableAddressStore maps currencies to a participant's
 * address capable of accepting the currency. This structure exists to
 * accomodate safe migration for grain/payout token changes. Users must verify
 * themselves that the address they are supplying is capable of receiving their
 * share of a grain distribution.
 */
type PayableAddressStore = Map<CurrencyId, PayoutAddress>;

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
  _nameToId: Map<Name, IdentityId>;
  _lowercaseNames: Set<string>;
  _aliasAddressToIdentity: Map<NodeAddressT, IdentityId>;
  _accounts: Map<IdentityId, MutableAccount>;
  _allocations: Map<AllocationId, $ReadOnly<Allocation>>;
  _distributions: Map<DistributionId, $ReadOnly<Distribution>>;
  _allocationsToDistributions: Map<AllocationId, DistributionId>;
  _latestTimestamp: TimestampMs = -Infinity;
  _lastDistributionTimestamp: TimestampMs = -Infinity;

  constructor() {
    this._ledgerEventLog = new JsonLog();
    this._nameToId = new Map();
    this._lowercaseNames = new Set();
    this._aliasAddressToIdentity = new Map();
    this._accounts = new Map();
    this._allocations = new Map();
    this._distributions = new Map();
    this._allocationsToDistributions = new Map();
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
   * Return whether the IdentityName in question is available.
   *
   * For convenience in test code (and consistency with createIdentity and renameIdentity),
   * the name is provided as a string. If the string is not a valid name, an error will be
   * thrown.
   */
  nameAvailable(name: string): boolean {
    // Error if the name is not valid.
    nameFromString(name);
    // We don't need to explicitly test the name itself, since if a name
    // is reserved, its lowercased version is also reserved.
    return !this._lowercaseNames.has(name.toLowerCase());
  }

  /**
   * Return the account matching a given NodeAddress, if one exists.
   *
   * Returns null if there is no account matching that address.
   */
  accountByAddress(address: NodeAddressT): Account | null {
    const identityId = this._aliasAddressToIdentity.get(address);
    if (identityId == null) {
      return null;
    }
    return this.account(identityId);
  }

  /**
   * Return the account with the given name, if one exists.
   *
   * Returns null if there is no account matching that address.
   *
   * Note: This is case sensitive.
   */
  accountByName(name: string): Account | null {
    const identityId = this._nameToId.get(nameFromString(name));
    if (identityId == null) {
      return null;
    }
    return this.account(identityId);
  }

  /**
   * Get the Allocation associated with a particular Allocation ID.
   *
   * If the ID is not in the ledger, an error is thrown.
   */
  allocation(id: AllocationId): Allocation {
    const allocation = this._allocations.get(id);
    if (allocation == null) throw new Error(`no Allocation for id: ${id}`);
    return allocation;
  }

  /**
   * Get an Iterator over all Allocations in the order they occur in the Ledger.
   */
  allocations(): Iterator<Allocation> {
    return this._allocations.values();
  }

  /**
   * Get the Distribution associated with a particular Distribution ID.
   *
   * If the ID is not in the ledger, an error is thrown.
   */
  distribution(id: DistributionId): Distribution {
    const distribution = this._distributions.get(id);
    if (distribution == null) throw new Error(`no Distribution for id: ${id}`);
    return distribution;
  }

  /**
   * Get an Iterator over all Distributions in the order they occur in the Ledger.
   */
  distributions(): Iterator<Distribution> {
    return this._distributions.values();
  }

  /**
   * Get the Distribution associated with a particular Allocation ID.
   *
   * If the Allocation ID is not associated with a distribution, an error is thrown.
   */
  distributionByAllocationId(allocationId: AllocationId): Distribution {
    const distributionId = this._allocationsToDistributions.get(allocationId);
    if (distributionId == null)
      throw new Error(`no Distribution for allocation id: ${allocationId}`);
    return this.distribution(distributionId);
  }

  /**
   * Create an account in the ledger.
   *
   * This will reserve the identity's name, and its innate address.
   *
   * This returns the newly created Identity's ID, so that the caller
   * store it for future reference.
   *
   * Will fail if the name is not valid, or already taken.
   */
  createIdentity(type: IdentityType, name: string): IdentityId {
    const identity = newIdentity(type, name);
    const action = {
      type: "CREATE_IDENTITY",
      identity,
    };
    this._createAndProcessEvent(action);
    return NullUtil.get(this._nameToId.get(identity.name));
  }
  _createIdentity({identity}: CreateIdentity) {
    if (this._nameToId.has(identity.name)) {
      // This identity already exists; return.
      throw new Error(`createIdentity: name already taken: ${identity.name}`);
    }
    if (this._lowercaseNames.has(identity.name.toLowerCase())) {
      throw new Error(
        `createIdentity: already have same name with different capitalization: ${identity.name}`
      );
    }
    if (identity.aliases.length !== 0) {
      throw new Error(`createIdentity: new identities may not have aliases`);
    }
    // istanbul ignore if
    if (this._aliasAddressToIdentity.has(identity.address)) {
      // This should never happen, as it implies a UUID conflict.
      throw new Error(
        `createIdentity: innate address already claimed ${identity.id}`
      );
    }

    // Mutations! Method must not fail after this comment.
    this._nameToId.set(identity.name, identity.id);
    this._lowercaseNames.add(identity.name.toLowerCase());
    // Reserve this identity's own address
    this._aliasAddressToIdentity.set(identity.address, identity.id);
    // Every identity has a corresponding Account.
    this._accounts.set(identity.id, {
      balance: G.ZERO,
      paid: G.ZERO,
      identity,
      active: false,
      allocationHistory: [],
      payoutAddresses: new Map(),
    });
  }

  /**
   * Merge two identities together.
   *
   * One identity is considered the "base" and the other is the "target".
   * The target is absorbed into the base, meaning:
   * - Base gets the Grain balance, and lifetime paid amount added to its account.
   * - Base gets every alias that the target had.
   * - Base gets the target's own address as an alias.
   * - The target account is removed from the ledger.
   * - The target's login name is freed.
   *
   * Attempting to merge an identity that doesn't exist, or to merge an identity into
   * itself, will error.
   */
  mergeIdentities(opts: {base: IdentityId, target: IdentityId}): Ledger {
    const {base, target} = opts;
    const action = {
      type: "MERGE_IDENTITIES",
      base,
      target,
    };
    this._createAndProcessEvent(action);
    return this;
  }
  _mergeIdentities({base, target}: MergeIdentities) {
    const baseAccount = this._mutableAccount(base);
    const targetAccount = this.account(target);
    const baseIdentity = baseAccount.identity;
    const targetIdentity = targetAccount.identity;
    if (base === target) {
      throw new Error(
        `tried to merge identity @${baseIdentity.name} with itself`
      );
    }

    const updatedAliases = baseIdentity.aliases.slice();
    const transferAlias = (alias: Alias) => {
      updatedAliases.push(alias);
      this._aliasAddressToIdentity.set(alias.address, baseIdentity.id);
    };
    // Mutation follows. Nothing after this line may throw.
    targetIdentity.aliases.forEach((a) => transferAlias(a));
    const innateAlias = {
      address: targetIdentity.address,
      description: `identity @${targetIdentity.name} (id: ${targetIdentity.id})`,
    };
    transferAlias(innateAlias);
    const updatedIdentity = {
      ...baseIdentity,
      aliases: updatedAliases,
    };
    baseAccount.identity = updatedIdentity;
    baseAccount.paid = G.add(baseAccount.paid, targetAccount.paid);
    baseAccount.allocationHistory = baseAccount.allocationHistory
      .concat(targetAccount.allocationHistory)
      .sort((a, b) => a.credTimestampMs - b.credTimestampMs);
    // merge payout payoutAddresses under one account, but don't overwrite base
    // account entries
    baseAccount.payoutAddresses = new Map([
      ...targetAccount.payoutAddresses.entries(),
      ...baseAccount.payoutAddresses.entries(),
    ]);
    baseAccount.balance = G.add(baseAccount.balance, targetAccount.balance);
    this._accounts.delete(targetIdentity.id);
    this._nameToId.delete(targetIdentity.name);
    this._lowercaseNames.delete(targetIdentity.name.toLowerCase());
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
      newName: nameFromString(newName),
    });
    return this;
  }
  _renameIdentity({identityId, newName}: RenameIdentity) {
    if (!this._accounts.has(identityId)) {
      throw new Error(`renameIdentity: no identity matches id ${identityId}`);
    }
    const account = this._mutableAccount(identityId);
    const existingIdentity = account.identity;
    const existingName = existingIdentity.name;
    if (existingName === newName) {
      // We error rather than silently succeed because we don't want the ledger
      // to get polluted with no-op records (no successful operations are
      // idempotent, since they do add to the ledger logs)
      throw new Error(`renameIdentity: identity already has name ${newName}`);
    }
    if (this._nameToId.has(newName)) {
      // We already checked that the name is not owned by this identity,
      // so it is a conflict. Fail.
      throw new Error(`renameIdentity: conflict on name ${newName}`);
    }
    const lowerCased = newName.toLowerCase();
    if (
      this._lowercaseNames.has(lowerCased) &&
      lowerCased !== existingName.toLowerCase()
    ) {
      throw new Error(
        `renameIdentity: already have same name with different capitalization: ${newName}`
      );
    }
    const updatedIdentity = {
      id: identityId,
      name: newName,
      subtype: existingIdentity.subtype,
      address: existingIdentity.address,
      aliases: existingIdentity.aliases,
    };

    // Mutations! Method must not fail after this comment.
    this._nameToId.delete(existingIdentity.name);
    this._nameToId.set(newName, identityId);
    this._lowercaseNames.delete(existingIdentity.name.toLowerCase());
    this._lowercaseNames.add(newName.toLowerCase());
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
  addAlias(identityId: IdentityId, alias: Alias): Ledger {
    this._createAndProcessEvent({
      type: "ADD_ALIAS",
      identityId,
      alias,
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
    if (existingAliases.map((a) => a.address).indexOf(alias.address) !== -1) {
      throw new Error(
        `addAlias: identity already has alias: ${
          existingIdentity.name
        }, ${NodeAddress.toString(alias.address)}`
      );
    }
    if (this._aliasAddressToIdentity.has(alias.address)) {
      // Some other identity has this alias; fail.
      throw new Error(
        `addAlias: alias ${NodeAddress.toString(alias.address)} already bound`
      );
    }

    // Mutations below; method must not fail after this line.
    this._aliasAddressToIdentity.set(alias.address, identityId);
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
      distribution,
    });
    return this;
  }
  _distributeGrain({distribution}: DistributeGrain) {
    const parseResult = distributionParser.parse(distribution);
    if (!parseResult.ok) {
      throw new Error(`invalid distribution: ${parseResult.err}`);
    }
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
    this._distributions.set(distribution.id, distribution);
    for (const allocation of distribution.allocations) {
      this._allocations.set(allocation.id, allocation);
      this._allocationsToDistributions.set(allocation.id, distribution.id);
      for (const grainReceipt of allocation.receipts) {
        this._allocateGrain({
          grainReceipt,
          allocationId: allocation.id,
          credTimestampMs: distribution.credTimestamp,
        });
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
  |}): this {
    const {from, to, amount, memo} = opts;
    this._createAndProcessEvent({
      from,
      to,
      amount,
      memo,
      type: "TRANSFER_GRAIN",
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

  changeIdentityType(identityId: IdentityId, newType: IdentityType): Ledger {
    this._createAndProcessEvent({
      type: "CHANGE_IDENTITY_TYPE",
      newType,
      identityId,
    });
    return this;
  }
  _changeIdentityType({identityId, newType}: ChangeIdentityType) {
    const parseResult = identityTypeParser.parse(newType);
    if (!parseResult.ok) {
      throw new Error(`changeIdentityType: invalid type ${newType}`);
    }
    if (!this._accounts.has(identityId)) {
      throw new Error(
        `changeIdentityType: no identity matches id ${identityId}`
      );
    }
    const account = this._mutableAccount(identityId);
    const existingIdentity = account.identity;
    if (existingIdentity.subtype === newType) {
      // We error rather than silently succeed because we don't want the ledger
      // to get polluted with no-op records (no successful operations are
      // idempotent, since they do add to the ledger logs)
      throw new Error(
        `changeIdentityType: identity already has type ${newType}`
      );
    }
    const updatedIdentity = {
      id: identityId,
      name: existingIdentity.name,
      subtype: newType,
      address: existingIdentity.address,
      aliases: existingIdentity.aliases,
    };

    // Mutations! Method must not fail after this comment.
    account.identity = updatedIdentity;
  }

  /**
   * setPayoutAddress allows participants to set a payable address to collect
   * grain. These addresses are keyed on a specific currency, which ensures that
   * users don't erroneously receive a grain distribution to an address that
   * cannot handle it (such as a custodial wallet, or rigidly-designed
   * contract) and effectively lose that reward.
   *
   * An address may be deleted by passing in `null` for the
   * `payoutAddress` parameter. This is useful in case the underlying private key
   * is compromised or the exchange hosting a custodial account is hacked.
   */
  setPayoutAddress(
    id: IdentityId,
    payoutAddress: PayoutAddress | null,
    chainId: ChainId,
    tokenAddress?: EthAddress
  ): Ledger {
    this._createAndProcessEvent({
      type: "SET_PAYOUT_ADDRESS",
      id,
      payoutAddress,
      currency: buildCurrency(chainId, tokenAddress),
    });
    return this;
  }
  _setPayoutAddress({id, currency, payoutAddress}: SetPayoutAddress) {
    if (!this._accounts.has(id)) {
      throw new Error(`setPayoutAddress: no identity matches id ${id}`);
    }
    const account = this._mutableAccount(id);
    const currencyResult = currencyParser.parse(currency);
    if (!currencyResult.ok) {
      throw new Error(
        `Invalid chainId or tokenAddress:
        ${currencyResult.err}`
      );
    }
    if (payoutAddress !== null) {
      const addressResult = ethAddressParser.parse(payoutAddress);
      if (!addressResult.ok) {
        throw new Error(
          `setPayoutAddress: invalid payout address: ${payoutAddress}`
        );
      }
      // Mutations! Method must not fail below this comment.
      account.payoutAddresses.set(
        JSON.stringify(currencyResult.value),
        payoutAddress
      );
      return;
    }
    // else (payoutAddress === null) and we delete the entry
    account.payoutAddresses.delete(JSON.stringify(currencyResult.value));
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
   * Serialize the events as a JsonLog-style newline-delimited JSON
   * string.
   */
  serialize(): string {
    return this._ledgerEventLog.toString();
  }

  /**
   * Parse events serialized as a JsonLog-style newline-delimited JSON
   * string (e.g., by `serialize`).
   */
  static parse(eventLog: string): Ledger {
    const jsonLog = JsonLog.fromString(eventLog, ledgerEventParser);
    return Ledger.fromEventLog(Array.from(jsonLog.values()));
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
      case "MERGE_IDENTITIES":
        this._mergeIdentities(action);
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
      case "CHANGE_IDENTITY_TYPE":
        this._changeIdentityType(action);
        break;
      case "SET_PAYOUT_ADDRESS":
        this._setPayoutAddress(action);
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
    this._ledgerEventLog.append(e);
  }

  _createAndProcessEvent(action: Action) {
    const ledgerTimestamp = _getTimestamp();
    const ledgerEvent = {
      ledgerTimestamp,
      action,
      version: "1",
      uuid: uuid.random(),
    };
    this._processEvent(ledgerEvent);
  }

  // Helper method for recording that Grain was allocated to a identity.
  // Increases the identity's paid amount and balance in sync.
  _allocateGrain(params: {|
    +grainReceipt: GrainReceipt,
    +allocationId: AllocationId,
    +credTimestampMs: TimestampMs,
  |}) {
    const account = this._mutableAccount(params.grainReceipt.id);
    account.paid = G.add(params.grainReceipt.amount, account.paid);
    account.allocationHistory.push(params);
    account.balance = G.add(params.grainReceipt.amount, account.balance);
  }
}

export type LedgerLog = $ReadOnlyArray<LedgerEvent>;

export type LedgerEvent = {|
  +action: Action,
  +ledgerTimestamp: TimestampMs,
  +version: "1",
  +uuid: uuid.Uuid,
|};

/**
 * The Actions are used to store the history of Ledger changes.
 */
type Action =
  | CreateIdentity
  | RenameIdentity
  | AddAlias
  | MergeIdentities
  | ToggleActivation
  | DistributeGrain
  | TransferGrain
  | ChangeIdentityType
  | SetPayoutAddress;

type CreateIdentity = {|
  +type: "CREATE_IDENTITY",
  +identity: Identity,
|};
const createIdentityParser: C.Parser<CreateIdentity> = C.object({
  type: C.exactly(["CREATE_IDENTITY"]),
  identity: identityParser,
});

type RenameIdentity = {|
  +type: "RENAME_IDENTITY",
  +identityId: IdentityId,
  +newName: Name,
|};
const renameIdentityParser: C.Parser<RenameIdentity> = C.object({
  type: C.exactly(["RENAME_IDENTITY"]),
  identityId: uuid.parser,
  newName: nameParser,
});

type ChangeIdentityType = {|
  +type: "CHANGE_IDENTITY_TYPE",
  +identityId: IdentityId,
  +newType: IdentityType,
|};
const changeIdentityTypeParser = C.object({
  type: C.exactly(["CHANGE_IDENTITY_TYPE"]),
  identityId: uuid.parser,
  newType: identityTypeParser,
});

export type AddAlias = {|
  +type: "ADD_ALIAS",
  +identityId: IdentityId,
  +alias: Alias,
|};
const addAliasParser: C.Parser<AddAlias> = C.object({
  type: C.exactly(["ADD_ALIAS"]),
  identityId: uuid.parser,
  alias: aliasParser,
});

type MergeIdentities = {|
  +type: "MERGE_IDENTITIES",
  +base: IdentityId,
  +target: IdentityId,
|};
const mergeIdentitiesParser: C.Parser<MergeIdentities> = C.object({
  type: C.exactly(["MERGE_IDENTITIES"]),
  base: uuid.parser,
  target: uuid.parser,
});

type ToggleActivation = {|
  +type: "TOGGLE_ACTIVATION",
  +identityId: IdentityId,
|};
const toggleActivationParser: C.Parser<ToggleActivation> = C.object({
  type: C.exactly(["TOGGLE_ACTIVATION"]),
  identityId: uuid.parser,
});

type DistributeGrain = {|
  +type: "DISTRIBUTE_GRAIN",
  +distribution: Distribution,
|};
const distributeGrainParser: C.Parser<DistributeGrain> = C.object({
  type: C.exactly(["DISTRIBUTE_GRAIN"]),
  distribution: distributionParser,
});

export type TransferGrain = {|
  +type: "TRANSFER_GRAIN",
  +from: IdentityId,
  +to: IdentityId,
  +amount: G.Grain,
  +memo: string | null,
|};

type SetPayoutAddress = {|
  +type: "SET_PAYOUT_ADDRESS",
  +id: IdentityId,
  +currency: Currency,
  +payoutAddress: EthAddress | null,
|};

const setPayoutAddressParser: C.Parser<SetPayoutAddress> = C.object({
  type: C.exactly(["SET_PAYOUT_ADDRESS"]),
  id: uuid.parser,
  currency: currencyParser,
  payoutAddress: ethAddressParser,
});

const transferGrainParser: C.Parser<TransferGrain> = C.object({
  type: C.exactly(["TRANSFER_GRAIN"]),
  from: uuid.parser,
  to: uuid.parser,
  amount: G.parser,
  memo: C.orElse([C.string, C.null_]),
});

const actionParser: C.Parser<Action> = C.orElse([
  createIdentityParser,
  renameIdentityParser,
  changeIdentityTypeParser,
  addAliasParser,
  mergeIdentitiesParser,
  toggleActivationParser,
  distributeGrainParser,
  transferGrainParser,
  setPayoutAddressParser,
]);

const ledgerEventParser: C.Parser<LedgerEvent> = C.object({
  action: actionParser,
  ledgerTimestamp: C.number,
  version: C.exactly(["1"]),
  uuid: uuid.parser,
});

const _getTimestamp = () => Date.now();
