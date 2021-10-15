// @flow

import * as C from "../../util/combo";
import deepFreeze from "deep-freeze";

const ValidIdentityTypes = {
  USER: "USER",
  PROJECT: "PROJECT",
  ORGANIZATION: "ORGANIZATION",
  BOT: "BOT",
};

// export a read-only version of the ValidIdentityTypes object for programmatic reference
export const IdentityTypes: typeof ValidIdentityTypes =
  deepFreeze(ValidIdentityTypes);
export type IdentityType = $Keys<typeof IdentityTypes>;
export const parser: C.Parser<IdentityType> = C.exactly(
  Object.keys(IdentityTypes)
);
