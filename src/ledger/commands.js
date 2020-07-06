// @flow

import {type ProjectionQueries as Queries} from "./projection";
import {type User, aliasesDiffer} from "./user";
import {
  type Event,
  userCreated,
  usernameChanged,
  userAliasesChanged,
} from "./events";

/*
  These Commands are more strict than typical projection logic is.
  The idea is to avoid emitting invalid Events when possible.

  Uses generators because a conditional yield is much more practical
  than building an array of events to return.
*/

export function* trackUser(state: Queries, user: User): Iterable<Event> {
  if (!state.getUser(user.id)) {
    yield* createUser(state, user);
  } else {
    yield* updateUser(state, user);
  }
}

export function* createUser(state: Queries, user: User): Iterable<Event> {
  if (state.getUser(user.id)) {
    throw new Error(`User ID ${user.id} is already taken`);
  }

  if (state.usernameExists(user.name)) {
    throw new Error(`Username ${user.name} is already taken`);
  }

  // We know the required fields aren't taken, create the user.
  yield userCreated(user);

  // If the user already has aliases, create an event for those too.
  if (aliasesDiffer([], user.aliases)) {
    yield userAliasesChanged(user);
  }
}

export function* updateUser(state: Queries, user: User): Iterable<Event> {
  const existing: ?User = state.getUser(user.id);
  if (!existing) {
    throw new Error(`User with ID ${user.id} doesn't exist`);
  }

  // See if the username changed.
  if (user.name !== existing.name) {
    if (state.usernameExists(user.name)) {
      throw new Error(`Can't change username, "${user.name}" is already taken`);
    }
    yield usernameChanged(user);
  }

  // See if the aliases changed.
  if (aliasesDiffer(existing.aliases, user.aliases)) {
    yield userAliasesChanged(user);
  }
}
