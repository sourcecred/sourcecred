// @flow

import * as C from "../../util/combo";

import {type Login, parser as loginParser} from "./login";
import {type IdentityType, parser as identityTypeParser} from "./identityType";

export type IdentityDescription = {|
  +login: Login,
  +displayName: string,
  +type: IdentityType,
|};
export const parser: C.Parser<IdentityDescription> = C.object({
  login: loginParser,
  displayName: C.string,
  type: identityTypeParser,
});
