// @flow

import deepFreeze from "deep-freeze";
import type {ObjectId} from "../../graphql/schema";

export const BLACKLISTED_IDS: $ReadOnlyArray<ObjectId> = deepFreeze([
  // These are `Organization` nodes that are sometimes referenced in a
  // `User` context: in particular, as the author of a reaction.
  // See: https://gist.github.com/wchargin/a2b8561b81bcc932c84e493d2485ea8a
  "MDEyOk9yZ2FuaXphdGlvbjE3OTUyOTI1",
  "MDEyOk9yZ2FuaXphdGlvbjI5MTkzOTQ=",
  "MDEyOk9yZ2FuaXphdGlvbjEyNDE3MDI0",
  "MDEyOk9yZ2FuaXphdGlvbjQzMDkzODIw",
  "MDEyOk9yZ2FuaXphdGlvbjEyNDk5MDI=", // techtribe
  // These are `Bot` nodes that are sometimes referenced in a `User`
  // context: in particular, as the author of a commit.
  "MDM6Qm90MjMwNDAwNzY=", // greenkeeper
  "MDM6Qm90NDk2OTkzMzM=", // dependabot
  "MDM6Qm90NDY0NDczMjE=", // allcontributors
  // These are the offending reactions.
  "MDg6UmVhY3Rpb24yMTY3ODkyNQ==",
  "MDg6UmVhY3Rpb240NDMwMzQ1",
  "MDg6UmVhY3Rpb24xMDI4MzQxOA==",
  "MDg6UmVhY3Rpb24zNDUxNjA2MQ==",
  // Now org used to be a user (@nueko)
  "MDEyOk9yZ2FuaXphdGlvbjIxMzQ5NTM=",
  // Problematic interactions they did as a user: Thumbs up reactions.
  "MDg6UmVhY3Rpb24xNTUyODc3OQ==", // https://github.com/quasarframework/quasar/issues/1064
  "MDg6UmVhY3Rpb24xNjA5NDYyOQ==", // https://github.com/quasarframework/quasar/issues/1123#issuecomment-343846259
  "MDg6UmVhY3Rpb24xNjIxNTMzNQ==", // https://github.com/quasarframework/quasar/pull/1128#issuecomment-344605228
  "MDg6UmVhY3Rpb24xMjIxMTk2Ng==", //https://github.com/passbolt/passbolt_api/issues/19
]);
