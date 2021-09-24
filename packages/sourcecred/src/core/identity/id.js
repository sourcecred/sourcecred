// @flow

import {type Uuid, parser, delimitedUuidParser} from "../../util/uuid";

export type IdentityId = Uuid;
export const identityIdParser = parser;
export const delimitedIdentityIdParser = delimitedUuidParser;
