// @flow

import type {User, UserId, Username} from "./user";
import type {
  Event,
  UserCreated,
  UsernameChanged,
  UserAliasesChanged,
} from "./events";

// For simplicity this is a mutating state implementation but isn't required.
export class State {
  +users: Map<UserId, User>;

  constructor() {
    this.users = new Map();
  }

  getUser(id: UserId): ?User {
    return this.users.get(id);
  }

  addUser(user: User): State {
    this.users.set(user.id, user);
    return this;
  }

  usernameExists(username: Username): boolean {
    for (const user of this.users.values()) {
      if (user.name === username) return false;
    }
    return true;
  }
}

export function fromEvents(events: Iterable<Event>): State {
  /*
    Note: we could use Array.from(...).reduce(...), however that means we need
    a copy of all events in memory. This for..of approach will have some memory
    allocation churn, but will free up intermediate states for GC. It would also
    be easy to upgrade to AsyncIterable when the event stream becomes large.
  */
  let state = new State();
  for (const event of events) {
    state = replayEvent(state, event);
  }
  return state;
}

export function replayEvent(state: State, event: Event): State {
  switch (event.type) {
    case "USER_CREATED":
      return _userCreated(state, event);
    case "USERNAME_CHANGED":
      return _usernameChanged(state, event);
    case "USER_ALIASES_CHANGED":
      return _userAliasesChanged(state, event);
    default:
      throw new Error(`Unknown type: ${(event.type: empty)}`);
  }
}

export function _userCreated(state: State, event: UserCreated): State {
  if (state.getUser(event.userId)) {
    throw new Error("User already exists");
  }

  return state.addUser({
    id: event.userId,
    name: event.name,
    aliases: [],
  });
}

export function _usernameChanged(state: State, event: UsernameChanged): State {
  const existing = state.getUser(event.userId);

  if (!existing) {
    throw new Error("User does not exist");
  }

  return state.addUser({
    ...(existing: User),
    name: event.name,
  });
}

export function _userAliasesChanged(
  state: State,
  event: UserAliasesChanged
): State {
  const existing = state.getUser(event.userId);

  if (!existing) {
    throw new Error("User does not exist");
  }

  return state.addUser({
    ...(existing: User),
    aliases: Array.from(event.aliases),
  });
}
