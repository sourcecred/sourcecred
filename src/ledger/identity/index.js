// @flow

export type {IdentityId} from "./id";
export type {Identity as IdentityV1} from "./v1";
export {newIdentity as newIdentityV1} from "./v1";

export type {IdentityType} from "./identityType";

export type {Login} from "./login";
export {loginFromString, parser as loginParser} from "./login";

export type {Alias} from "./alias";
export {parser as aliasParser} from "./alias";

export {contractions, graphNode} from "./v1";
export {declaration} from "./declaration";
