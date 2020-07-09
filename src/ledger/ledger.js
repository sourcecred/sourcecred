// @flow

/**
 * This module contains the ledger, for accumulating state updates related to
 * user identities and Grain distribution.
 *
 * A key requirement for the ledger is that we need to store an ordered log of
 * every action that's happened in the ledger, so that we can audit the ledger
 * state to ensure its integrity.
 */
import {
  type UserId,
  type User,
  type Username,
  userAddress,
  usernameFromString,
} from "./user";
import {type NodeAddressT, NodeAddress} from "../core/graph";
import {type TimestampMs} from "../util/timestamp";
import * as NullUtil from "../util/null";
import {random as randomUuid} from "../util/uuid";
import * as G from "./grain";

/**
 * An GrainAccount is an address that is present in the Ledger
 * and has some associated Grain.
 */
type MutableGrainAccount = {|
  +address: NodeAddressT,
  +userId: UserId | null,
  balance: G.Grain,
  paid: G.Grain,
|};

export type GrainAccount = $ReadOnly<MutableGrainAccount>;

/**
 * The ledger for storing identity changes and (eventually) Grain distributions.
 *
 * The following API methods change the ledger state:
 * - `createUser`
 * - `renameUser`
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
 * conflicting user) fails without mutating the ledger state; this way we avoid
 * ever getting the ledger in a corrupted state. To make this easier to test,
 * the test code uses deep equality testing on the ledger before/after
 * attempting illegal actions. To ensure that this testing works, we should
 * avoid adding any ledger state that can't be verified by deep equality
 * checking (e.g. don't store state in functions or closures that aren't
 * attached to the Ledger object).
 */
export class Ledger {
  _actionLog: Action[];
  _users: Map<UserId, User>;
  _usernameToId: Map<Username, UserId>;
  _aliases: Map<NodeAddressT, UserId>;
  _accounts: Map<NodeAddressT, MutableGrainAccount>;

  constructor() {
    this._actionLog = [];
    this._users = new Map();
    this._usernameToId = new Map();
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
   * If the address is associated with a user, that user's account is returned.
   * If the address is not associated with a user, but has received Grain in
   * the past, then an alias-style account is returned (no userId set).
   * If the address hasn't been encountered, we return undefined.
   */
  accountByAddress(address: NodeAddressT): ?GrainAccount {
    return this._accounts.get(this.canonicalAddress(address));
  }

  /**
   * Return all of the Users in the Ledger.
   */
  users(): $ReadOnlyArray<User> {
    return Array.from(this._users.values());
  }

  /**
   * Return the User matching given id, or undefined if no user
   * matches the id.
   */
  userById(id: UserId): ?User {
    return this._users.get(id);
  }

  /**
   * Return the User matching given username, or undefined
   * if no user matches the username.
   *
   * Throws if the name provided is invalid.
   */
  userByUsername(name: string): ?User {
    const username = usernameFromString(name);
    const id = this._usernameToId.get(username);
    if (id != null) {
      return this._users.get(id);
    }
  }

  /**
   * Get some address's "canoncial" address.
   *
   * If the address is the alias of some user, then
   * the user's innate address is caanonical. Otherwise,
   * the address is itself canonical.
   */
  canonicalAddress(address: NodeAddressT): NodeAddressT {
    const userId = this._aliases.get(address);
    if (userId != null) {
      return userAddress(userId);
    }
    return address;
  }

  /**
   * Create a User in the ledger.
   *
   * This will reserve the user's username, and its innate address.
   *
   * This returns the newly created User's ID, so that the caller
   * store it for future reference.
   *
   * Will fail if the username is not valid, or already taken.
   */
  createUser(name: string): UserId {
    const username = usernameFromString(name);
    this._act({
      type: "CREATE_USER",
      userId: randomUuid(),
      username,
      version: 1,
      timestamp: _getTimestamp(),
    });
    return NullUtil.get(this._usernameToId.get(username));
  }
  _createUser({username, userId, version}: CreateUserV1) {
    if (version !== 1) {
      throw new Error(`createUser: unrecognized version ${version}`);
    }
    if (this._usernameToId.has(username)) {
      // This user already exists; return.
      throw new Error(`createUser: username already taken: ${username}`);
    }
    // istanbul ignore if
    if (this._aliases.has(userAddress(userId))) {
      // This should never happen, as it implies a UUID conflict.
      throw new Error(`createUser: innate address already claimed ${userId}`);
    }
    const addr = userAddress(userId);

    // Mutations! Method must not fail after this comment.
    this._usernameToId.set(username, userId);
    this._users.set(userId, {name: username, id: userId, aliases: []});
    // Reserve this user's own address
    this._aliases.set(addr, userId);
    // Every user has a corresponding GrainAccount.
    this._accounts.set(addr, {
      balance: G.ZERO,
      paid: G.ZERO,
      address: addr,
      userId,
    });
  }

  /**
   * Change a user's username.
   *
   * Will fail if no user matches the userId, or if the user already has that
   * name, or if the user's new name is claimed by another user.
   */
  renameUser(userId: UserId, newName: string): Ledger {
    return this._act({
      type: "RENAME_USER",
      userId,
      newName: usernameFromString(newName),
      version: 1,
      timestamp: _getTimestamp(),
    });
  }
  _renameUser({userId, newName, version}: RenameUserV1) {
    if (version !== 1) {
      throw new Error(`renameUser: unrecognized version ${version}`);
    }
    const existingUser = this._users.get(userId);
    if (existingUser == null) {
      throw new Error(`renameUser: no user matches id ${userId}`);
    }
    if (existingUser.name === newName) {
      // We error rather than silently succeed because we don't want the ledger
      // to get polluted with no-op records (no successful operations are
      // idempotent, since they do add to the ledger logs)
      throw new Error(`renameUser: user already has name ${newName}`);
    }
    if (this._usernameToId.has(newName)) {
      // We already checked that the name is not owned by this user,
      // so it is a conflict. Fail.
      throw new Error(`renameUser: conflict on username ${newName}`);
    }
    const updatedUser = {
      id: userId,
      name: newName,
      aliases: existingUser.aliases,
    };

    // Mutations! Method must not fail after this comment.
    this._usernameToId.delete(existingUser.name);
    this._usernameToId.set(newName, userId);
    this._users.set(userId, updatedUser);
  }

  /**
   * Add an alias for a user.
   *
   * If the alias has a GrainAccount, then its balance is transfered to the
   * user, its paid is added to the user's paid amount, and then its account is
   * deleted.
   *
   * Will no-op if the user already has that alias.
   * Will fail if the user does not exist.
   * Will fail if the alias is already claimed, or if it is
   * another user's innate address.
   */
  addAlias(userId: UserId, alias: NodeAddressT): Ledger {
    return this._act({
      type: "ADD_ALIAS",
      userId,
      alias,
      version: 1,
      timestamp: _getTimestamp(),
    });
  }
  _addAlias({userId, alias, version}: AddAliasV1) {
    if (version !== 1) {
      throw new Error(`addAlias: unrecognized version ${version}`);
    }
    const existingUser = this._users.get(userId);
    if (existingUser == null) {
      throw new Error(`addAlias: no matching userId ${userId}`);
    }
    const existingAliases = existingUser.aliases;
    if (existingAliases.indexOf(alias) !== -1) {
      throw new Error(
        `addAlias: user already has alias: ${
          existingUser.name
        }, ${NodeAddress.toString(alias)}`
      );
    }
    if (this._aliases.has(alias)) {
      // Some other user has this alias; fail.
      throw new Error(
        `addAlias: alias ${NodeAddress.toString(alias)} already bound`
      );
    }
    this._aliases.set(alias, userId);
    const updatedAliases = existingAliases.slice();
    updatedAliases.push(alias);
    const updatedUser = {
      id: existingUser.id,
      name: existingUser.name,
      aliases: updatedAliases,
    };
    const addr = userAddress(userId);
    const aliasAccount = this._unsafeGetAccount(alias);
    const userAccount = this._unsafeGetAccount(addr);

    // State mutations! Method must not fail past this comment.
    this._users.set(userId, updatedUser);
    // Transfer alias's balance and paid to the canonical account
    userAccount.paid = G.add(userAccount.paid, aliasAccount.paid);
    userAccount.balance = G.add(userAccount.balance, aliasAccount.balance);
    this._accounts.delete(alias);
  }

  /**
   * Remove an alias from a user.
   *
   * In order to safely remove an alias, we need to know what proportion of
   * that user's Cred came from this alias. That way, we can re-allocate an
   * appropriate share of the user's lifetime grain receipts to the alias they
   * are disconnecting from. Otherwise, it would be possible for the user to
   * game the BALANCED allocation strategy by strategically linking and
   * unlinking aliases.
   *
   * When an alias is removed, none of the user's current Grain balance goes
   * back to that alias.
   *
   * If the alias was linked fraudulently (someone claimed another person's
   * account), then remedial action may be appropriate, e.g. transferring the
   * fraudster's own Grain back to the account they tried to steal from.
   *
   * Will no-op if the user doesn't have that alias.
   *
   * Will fail if the user does not exist.
   *
   * Will fail if the alias is in fact the user's innate address.
   */
  removeAlias(
    userId: UserId,
    alias: NodeAddressT,
    credProportion: number
  ): Ledger {
    if (credProportion < 0 || credProportion > 1 || !isFinite(credProportion)) {
      throw new Error(`removeAlias: invalid credProportion ${credProportion}`);
    }
    const paid = this._getAccount(alias).paid;
    const retroactivePaid = G.multiplyFloat(paid, credProportion);

    return this._act({
      type: "REMOVE_ALIAS",
      userId,
      alias,
      version: 1,
      retroactivePaid,
      timestamp: _getTimestamp(),
    });
  }
  _removeAlias({userId, alias, version, retroactivePaid}: RemoveAliasV1) {
    if (version !== 1) {
      throw new Error(`removeAlias: unrecognized version ${version}`);
    }
    const existingUser = this._users.get(userId);
    if (existingUser == null) {
      throw new Error(`removeAlias: no user matching id ${userId}`);
    }
    if (alias === userAddress(userId)) {
      throw new Error(`removeAlias: cannot remove user's innate address`);
    }
    const existingAliases = existingUser.aliases;
    const idx = existingAliases.indexOf(alias);
    if (idx === -1) {
      throw new Error(
        `removeAlias: user does not have alias: ${
          existingUser.name
        }, ${NodeAddress.toString(alias)}`
      );
    }
    const aliases = existingAliases.slice();
    aliases.splice(idx, 1);

    // State mutations! Method must not fail past this comment.
    const userAccount = this._unsafeGetAccount(alias);
    this._aliases.delete(alias);
    this._users.set(userId, {
      id: userId,
      name: existingUser.name,
      aliases,
    });
    if (retroactivePaid !== G.ZERO) {
      userAccount.paid = G.sub(userAccount.paid, retroactivePaid);
      // Create a new alias account to hold onto our retroactivePaid amount
      this._unsafeGetAccount(alias).paid = retroactivePaid;
    }
  }

  /**
   * Retrieve the log of all actions in the Ledger's history.
   *
   * May be used to reconstruct the Ledger after serialization.
   */
  actionLog(): LedgerLog {
    return this._actionLog;
  }

  /**
   * Reconstruct a Ledger from a LedgerLog.
   */
  static fromActionLog(log: LedgerLog): Ledger {
    const ledger = new Ledger();
    for (const a of log) {
      ledger._act(a);
    }
    return ledger;
  }

  _act(a: Action): Ledger {
    switch (a.type) {
      case "CREATE_USER":
        this._createUser(a);
        break;
      case "RENAME_USER":
        this._renameUser(a);
        break;
      case "ADD_ALIAS":
        this._addAlias(a);
        break;
      case "REMOVE_ALIAS":
        this._removeAlias(a);
        break;
      // istanbul ignore next: unreachable per Flow
      default:
        throw new Error(`Unknown type: ${(a.type: empty)}`);
    }
    this._actionLog.push(a);
    return this;
  }

  // Helper method for recording that Grain was allocated to a user.
  // Increases the user's paid amount and balance in sync.
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
        userId: null,
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
export opaque type LedgerLog = $ReadOnlyArray<Action>;

/**
 * The Actions are used to store the history of Ledger changes.
 */
type Action = CreateUserV1 | RenameUserV1 | AddAliasV1 | RemoveAliasV1;

type CreateUserV1 = {|
  +type: "CREATE_USER",
  +username: Username,
  +version: 1,
  +timestamp: TimestampMs,
  +userId: UserId,
|};
type RenameUserV1 = {|
  +type: "RENAME_USER",
  +userId: UserId,
  +newName: Username,
  +version: 1,
  +timestamp: TimestampMs,
|};
type AddAliasV1 = {|
  +type: "ADD_ALIAS",
  +userId: UserId,
  +alias: NodeAddressT,
  +version: 1,
  +timestamp: TimestampMs,
|};
type RemoveAliasV1 = {|
  +type: "REMOVE_ALIAS",
  +userId: UserId,
  +alias: NodeAddressT,
  +version: 1,
  +timestamp: TimestampMs,
  +retroactivePaid: G.Grain,
|};

const _getTimestamp = () => Date.now();
