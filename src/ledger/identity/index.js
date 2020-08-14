// @flow

export type {IdentityId} from "./id";
export type {Identity} from "./identity";
export {
  newIdentity,
  contractions,
  graphNode,
  parser as identityParser,
} from "./identity";

export type {IdentityType} from "./identityType";

export type {Login} from "./login";
export {loginFromString, parser as loginParser} from "./login";

export type {Alias} from "./alias";
export {parser as aliasParser} from "./alias";

export {declaration} from "./declaration";
