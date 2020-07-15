// @flow

import * as C from "../../util/combo";
import {_validateUrl} from "./initiativesDirectory";

export type InitiativesConfig = {|
  +remoteUrl: string,
|};

export const parser: C.Parser<InitiativesConfig> = C.object({
  remoteUrl: C.fmap(C.string, _validateUrl),
});
