// @flow

import * as Combo from "../../util/combo";

export type GitcoinConfig = {|
  +pgDatabaseUrl: string,
  +gitcoinHost: string,
  +userWhitelist: $ReadOnlyArray<string>,
|};

export const parser: Combo.Parser<GitcoinConfig> = (() => {
  const C = Combo;
  return C.object({
    pgDatabaseUrl: C.string,
    gitcoinHost: C.string,
    userWhitelist: C.array(C.string),
  });
})();
