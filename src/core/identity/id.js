// @flow

import {type Uuid, parser} from "../../util/uuid";

export type IdentityId = Uuid;
export const identityIdParser = parser;
