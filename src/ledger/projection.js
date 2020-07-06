// @flow

import type {Event} from "./events";
import type {User, UserId, Username} from "./user";
import replayEvent from "./replayEvent";

// The read-only queries for this API.
export interface ProjectionQueries {
  getUser(id: UserId): ?User;
  usernameExists(username: Username): boolean;
}

/**
 * The Projection is a state representation, which is derived from replaying a
 * series of events. It should not be considered a canonical view, but rather
 * a use-case optimized interpretation of the underlying events.
 *
 * This class is a "dumb" representation, which only has a read-write API.
 * It's kept separate from the projection logic which it defers to in `replay`.
 *
 * Note: this Projection is implemented as a mutating object. Though it's API
 * would support changing to an immutable implementation.
 */
export default class Projection implements ProjectionQueries {
  +users: Map<UserId, User> = new Map();

  getUser(id: UserId): ?User {
    return this.users.get(id);
  }

  usernameExists(username: Username): boolean {
    for (const user of this.users.values()) {
      if (user.name === username) return false;
    }
    return true;
  }

  /**
   * An idempotent update function to ensure the given User is in the state.
   * Returns an updated Projection.
   * Note: this is unchecked for business rules and is a mutating operation.
   * Business rules should be checked by `replayEvent`, so you'll rarely call
   * this in any other context.
   */
  addUser(user: User): Projection {
    this.users.set(user.id, user);
    return this;
  }

  /**
   * Replays any number of events, using this Projection as the current state.
   * Returns an updated Projection.
   * Note: currently this mutates the existing Projection.
   */
  replay(events: Iterable<Event>): Projection {
    let state = this;
    for (const event of events) {
      state = replayEvent(state, event);
    }
    return state;
  }

  // Helper function to start with an empty state and immediately replay events.
  static fromEvents(events: Iterable<Event>): Projection {
    return new Projection().replay(events);
  }
}
