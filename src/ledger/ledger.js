// @flow

/**
 * This module contains the ledger, for accumulating state updates related to
 * user identities and Grain distribution.
 *
 * A key requirement for the ledger is that we need to store an ordered log of
 * every action that's happened in the ledger, so that we can audit the ledger
 * state to ensure its integrity.
 */
import deepEqual from "lodash.isequal";
import {type UserId, type User, type Username, userAddress} from "./user";
import {type NodeAddressT, NodeAddress} from "../core/graph";

/**
 * The ledger for storing identity changes and (eventually) Grain distributions.
 *
 * The following API methods change the ledger state:
 * - `addUser`
 * - `renameUser`
 * - `removeUser`
 * - `addAlias`
 * - `removeAlias`
 *
 * Every time the ledger state is changed, a corresponding Action is added to
 * the ledger's action log. The ledger state may be serialized by saving the
 * action log, and then reconstructed by replaying the action log. The
 * corresponding methods are `actionLog` and `Ledger.fromActionLog`.
 *
 * It's important that any API method that fails (e.g. trying to add a
 * conflicting user) fails without mutating the ledger state; this way we avoid
 * ever getting the ledger in a corrupted state. To make this easier to test,
 * the test code uses deep equality testing on the ledger before/after
 * attempting illegal actions. To ensure that this testing works, we should
 * avoid adding any ledger state that can't be verified by deep equality
 * checking (e.g. don't store state in functions or closures that aren't
 * attached to the Ledger object).
 *
 * Currently, the Ledger only supports user management; logic for tracking
 * Grain distributions will be added in a future commit.
 */
export class Ledger {
  _actionLog: Action[];
  _users: Map<UserId, User>;
  _usernameToId: Map<Username, UserId>;
  _aliases: Set<NodeAddressT>;

  constructor() {
    this._actionLog = [];
    this._users = new Map();
    this._usernameToId = new Map();
    this._aliases = new Set();
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
   */
  userByUsername(name: Username): ?User {
    const id = this._usernameToId.get(name);
    if (id != null) {
      return this._users.get(id);
    }
  }

  /**
   * Add a User to the Ledger.
   *
   * This will reserve the user's username, and its innate address.
   *
   * Will no-op is the user is already in the ledger.
   *
   * Will fail if a conflicting user is present, or if the user's username is
   * already taken, or if the user's innate address is already taken, or if any
   * of the user's aliases are already taken.
   */
  addUser(user: User): Ledger {
    return this._act({type: "ADD_USER", user: user});
  }
  _addUser(user: User) {
    const existingUser = this._users.get(user.id);
    if (existingUser != null) {
      if (deepEqual(existingUser, user)) {
        // No-op; This user already exists in the ledger.
        return;
      } else {
        throw new Error(`addUser: conflicting user with id ${user.id}`);
      }
    }
    if (this._usernameToId.has(user.name)) {
      throw new Error(`addUser: username already claimed ${user.name}`);
    }
    for (const alias of user.aliases) {
      if (this._aliases.has(alias)) {
        throw new Error(
          `addUser: alias already claimed: ${NodeAddress.toString(alias)}`
        );
      }
    }
    if (this._aliases.has(userAddress(user.id))) {
      throw new Error(`addUser: innate address already claimed ${user.id}`);
    }

    // Now that we've done all our validation, we update state.
    // This way, in case we fail, we don't get the ledger into a corrupted state.
    for (const alias of user.aliases) {
      this._aliases.add(alias);
    }
    this._usernameToId.set(user.name, user.id);
    this._users.set(user.id, user);
    // Reserve this user's own address
    this._aliases.add(userAddress(user.id));
  }

  /**
   * Change a user's username.
   *
   * Will fail if no user matches the userId, or if the user's new
   * name is already claimed.
   */
  renameUser(userId: UserId, newName: Username): Ledger {
    return this._act({type: "RENAME_USER", userId, newName});
  }
  _renameUser(userId: UserId, newName: Username) {
    const existingUser = this._users.get(userId);
    if (existingUser == null) {
      throw new Error(`renameUser: no user matches id ${userId}`);
    }
    if (existingUser.name === newName) {
      // No-op; user already has this name.
      return;
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
    this._usernameToId.delete(existingUser.name);
    this._usernameToId.set(newName, userId);
    this._users.set(userId, updatedUser);
  }

  /**
   * Remove a user from the ledger.
   *
   * This also free's the user's username,
   * the user's innate address, and all the user's aliases.
   *
   * Will no-op if the user doesn't exist.
   */
  removeUser(userId: UserId): Ledger {
    return this._act({type: "REMOVE_USER", userId});
  }
  _removeUser(userId: UserId) {
    const existingUser = this._users.get(userId);
    if (existingUser == null) {
      // User already removed; no-op.
      return;
    }
    this._usernameToId.delete(existingUser.name);
    this._users.delete(userId);
    this._aliases.delete(userAddress(userId));
    for (const a of existingUser.aliases) {
      this._aliases.delete(a);
    }
  }

  /**
   * Add an alias for a user.
   *
   * Will no-op if the user already has that alias.
   *
   * Will faill if the user does not exist.
   *
   * Will fail if the alias is already claimed, or if it is
   * another user's innate address.
   */
  addAlias(userId: UserId, alias: NodeAddressT): Ledger {
    return this._act({type: "ADD_ALIAS", userId, alias});
  }
  _addAlias(userId: UserId, alias: NodeAddressT) {
    const existingUser = this._users.get(userId);
    if (existingUser == null) {
      throw new Error(`addAlias: no matching userId ${userId}`);
    }
    const existingAliases = existingUser.aliases;
    if (existingAliases.indexOf(alias) !== -1) {
      // User already has this alias; no-op.
      return;
    }
    if (this._aliases.has(alias)) {
      // Some other user has this alias; fail.
      throw new Error(
        `addAlias: alias ${NodeAddress.toString(alias)} already bound`
      );
    }
    this._aliases.add(alias);
    const updatedAliases = existingAliases.slice();
    updatedAliases.push(alias);
    const updatedUser = {
      id: existingUser.id,
      name: existingUser.name,
      aliases: updatedAliases,
    };
    this._users.set(userId, updatedUser);
  }

  /**
   * Remove an alias from a user.
   *
   * Will no-op if the user doesn't have that alias.
   *
   * Will fail if the user does not exist.
   *
   * Will fail if the alias is in fact the user's innate address.
   */
  removeAlias(userId: UserId, alias: NodeAddressT): Ledger {
    return this._act({type: "REMOVE_ALIAS", userId, alias});
  }
  _removeAlias(userId: UserId, alias: NodeAddressT) {
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
      // User is already not bound to this alias. No-op.
      return;
    }
    const aliases = existingAliases.slice();
    aliases.splice(idx, 1);
    this._aliases.delete(alias);
    this._users.set(userId, {
      id: userId,
      name: existingUser.name,
      aliases,
    });
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
      case "ADD_USER":
        this._addUser(a.user);
        break;
      case "RENAME_USER":
        this._renameUser(a.userId, a.newName);
        break;
      case "REMOVE_USER":
        this._removeUser(a.userId);
        break;
      case "ADD_ALIAS":
        this._addAlias(a.userId, a.alias);
        break;
      case "REMOVE_ALIAS":
        this._removeAlias(a.userId, a.alias);
        break;
      default:
        throw new Error(`Unknown type: ${(a.type: empty)}`);
    }
    this._actionLog.push(a);
    return this;
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
type Action = AddUser | RenameUser | RemoveUser | AddAlias | RemoveAlias;

type AddUser = {|
  +type: "ADD_USER",
  +user: User,
|};
type RenameUser = {|
  +type: "RENAME_USER",
  +userId: UserId,
  +newName: Username,
|};
type RemoveUser = {|
  +type: "REMOVE_USER",
  +userId: UserId,
|};
type AddAlias = {|
  +type: "ADD_ALIAS",
  +userId: UserId,
  +alias: NodeAddressT,
|};
type RemoveAlias = {|
  +type: "REMOVE_ALIAS",
  +userId: UserId,
  +alias: NodeAddressT,
|};
