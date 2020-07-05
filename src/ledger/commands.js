// @flow

import {State} from "./state";
import {type User} from "./user";
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

type Aliases = $PropertyType<User, "aliases">;
function aliasesDiffer(a: Aliases, b: Aliases): boolean {
  const setA = new Set(a);
  const setB = new Set(b);

  // Should any value be missing from Set B, they're different.
  for (const value of setA) {
    if (!setB.has(value)) return false;
    setB.delete(value);
  }

  // After removing all of Set A, they're different if Set B is not empty.
  return setB.size === 0;
}
