// @flow

import * as C from "../util/combo";
import * as NullUtil from "../util/null";
import {
  type AllocationPolicy,
  type AllocationConfig,
  policyConfigParser,
  allocationConfigParser,
} from "../core/ledger/policies";
import {type Name, parser as nameParser} from "../core/identity/name";
import {
  type GrainIntegration,
  parser as bundledGrainIntegrationParser,
} from "./bundledGrainIntegrations";

export type RawGrainConfig = {|
  +allocationPolicies: $ReadOnlyArray<AllocationConfig>,
  +maxSimultaneousDistributions?: number,
  +sinkIdentity?: Name,
  +processDistributions?: boolean,
  +integration?: GrainIntegration,
|};

export type GrainConfig = {|
  +allocationPolicies: $ReadOnlyArray<AllocationPolicy>,
  +maxSimultaneousDistributions: number,
  +sinkIdentity?: Name,
  +processDistributions?: boolean,
  +integration?: GrainIntegration,
|};

export const rawParser: C.Parser<RawGrainConfig> = C.object(
  {
    allocationPolicies: C.array<AllocationConfig>(allocationConfigParser),
  },
  {
    maxSimultaneousDistributions: C.number,
    sinkIdentity: nameParser,
    processDistributions: C.boolean,
    integration: bundledGrainIntegrationParser,
  }
);

export const parser: C.Parser<GrainConfig> = C.fmap(
  C.object(
    {
      allocationPolicies: C.array<AllocationPolicy>(policyConfigParser),
    },
    {
      maxSimultaneousDistributions: C.number,
      sinkIdentity: nameParser,
      processDistributions: C.boolean,
      integration: bundledGrainIntegrationParser,
    }
  ),
  (config) => ({
    ...config,
    maxSimultaneousDistributions: NullUtil.orElse(
      config.maxSimultaneousDistributions,
      Infinity
    ),
  })
);
