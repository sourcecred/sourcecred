// @flow

import {State} from "./state";
import {type User, aliasesDiffer} from "./user";
import {
  type Event,
  userCreated,
  usernameChanged,
  userAliasesChanged,
} from "./events";

export function trackUser(state: State, user: User): $ReadOnlyArray<Event> {
  const existing: ?User = state.getUser(user.id);

  // User don't exist, create a new one.
  if (!existing) {
    if (state.usernameExists(user.name)) {
      throw new Error(
        `Can't create new user, the username ${user.name} is already taken`
      );
    }

    const events: Event[] = [];
    events.push(userCreated(user));
    // If the aliases are non-empty, create an event to set them too.
    if (aliasesDiffer([], user.aliases)) {
      events.push(userAliasesChanged(user));
    }
    return events;
  } else {
    const events: Event[] = [];
    if (user.name !== existing.name) {
      if (state.usernameExists(user.name)) {
        throw new Error(
          `Can't change username, the username ${user.name} is already taken`
        );
      }
      events.push(usernameChanged(user));
    }
    if (aliasesDiffer(existing.aliases, user.aliases)) {
      events.push(userAliasesChanged(user));
    }
    return events;
  }
}

