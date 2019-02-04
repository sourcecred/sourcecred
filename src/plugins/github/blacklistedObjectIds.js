// @flow

import type {ObjectId} from "../../graphql/schema";

export const BLACKLISTED_IDS: $ReadOnlyArray<ObjectId> = Object.freeze([
  // These are `Organization` nodes that are sometimes referenced in a
  // `User` context: in particular, as the author of a reaction.
  // See: https://gist.github.com/wchargin/a2b8561b81bcc932c84e493d2485ea8a
  // "MDEyOk9yZ2FuaXphdGlvbjE3OTUyOTI1",
  // "MDEyOk9yZ2FuaXphdGlvbjI5MTkzOTQ=",
  // "MDEyOk9yZ2FuaXphdGlvbjEyNDE3MDI0",
  // In this case, the bot used to be a user (@greenkeeper)
  // "MDM6Qm90MjMwNDAwNzY=",
  // These are the offending reactions.
  // "MDg6UmVhY3Rpb24yMTY3ODkyNQ==",
  // "MDg6UmVhY3Rpb240NDMwMzQ1",
  // "MDg6UmVhY3Rpb24xMDI4MzQxOA==",
]);
