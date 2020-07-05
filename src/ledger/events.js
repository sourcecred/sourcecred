// @flow

import type {UserId, Username} from "./user";
import {type NodeAddressT} from "../core/graph";
import {type TimestampMs} from "../util/timestamp";

/*
  Events are historical facts and outcomes of a command. Hence they are named
  in the past tense.

  All events include a version, because these models are immutable. Should we
  ever want to change an event's body or semantics, they should be implemented
  as a new version, while still supporting the previous one.
*/

export type Event = UserCreated | UsernameChanged | UserAliasesChanged;

// This event will claim to the UserId which we can't change, as well as the
// Username because it's a required field.
export type UserCreated = {|
  +type: "USER_CREATED",
  +version: 1,
  +timestamp: TimestampMs,
  +userId: UserId,
  +name: Username,
|};

// Note this event body is identical to UserCreated, but it's semantics are
// different. One demands that the user doesn't exist yet, the other that it
// does already exist.
export type UsernameChanged = {|
  +type: "USERNAME_CHANGED",
  +version: 1,
  +timestamp: TimestampMs,
  +userId: UserId,
  +name: Username,
|};

// Overrides the current set of aliases with a new set.
// Difference can be obtained by comparing with the previous set.
export type UserAliasesChanged = {|
  +type: "USER_ALIASES_CHANGED",
  +version: 1,
  +timestamp: TimestampMs,
  +userId: UserId,
  +aliases: Set<NodeAddressT>,
|};
