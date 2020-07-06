// @flow

import Projection from "./projection";
import type {User} from "./user";
import type {
  Event,
  UserCreated,
  UsernameChanged,
  UserAliasesChanged,
} from "./events";

/**
 * Implements the actual projection logic. It's separated from the Projection
 * class to separate the two responsibilities. Projection is responsible for
 * being a state representation and having some helpful methods to query and
 * update it. While this function is responsible for the event interpretation
 * logic and business rules surrounding how it's allowed to change.
 *
 * Note: this function is written with the assumption that the Projection is
 * immutable and will return updated copies, rather than `this`.
 *
 * Note: due to this (before, event) => after signature and the "dumb" Projection
 * class. It should be easier to isolate tests, because any kind of before-state
 * can be created and compared to any after-state without relying on replay.
 */
export default function replayEvent(
  state: Projection,
  event: Event
): Projection {
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

export function _userCreated(
  state: Projection,
  event: UserCreated
): Projection {
  if (state.getUser(event.userId)) {
    throw new Error("User already exists");
  }

  return state.addUser({
    id: event.userId,
    name: event.name,
    aliases: [],
  });
}

export function _usernameChanged(
  state: Projection,
  event: UsernameChanged
): Projection {
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
  state: Projection,
  event: UserAliasesChanged
): Projection {
  const existing = state.getUser(event.userId);

  if (!existing) {
    throw new Error("User does not exist");
  }

  return state.addUser({
    ...(existing: User),
    aliases: Array.from(event.aliases),
  });
}
