// @flow

import * as C from "../../util/combo";

export type IdentityType = "USER" | "PROJECT" | "ORGANIZATION" | "BOT";
export const parser: C.Parser<IdentityType> = C.exactly([
  "USER",
  "BOT",
  "ORGANIZATION",
  "PROJECT",
]);
