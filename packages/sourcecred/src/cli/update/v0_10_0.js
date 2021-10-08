// @flow

import {buildObject} from "../../util/buildObject";
import * as C from "../../util/combo";
import * as G from "../../core/ledger/grain";
import {
  fromInteger as toNonnegativeGrain,
  numberOrFloatStringParser,
  type NonnegativeGrain,
} from "../../core/ledger/nonnegativeGrain";
import {
  type AllocationConfig,
  allocationConfigParser,
} from "../../core/ledger/policies";
import {type Name, parser as nameParser} from "../../core/identity/name";
import {
  type GrainIntegration,
  parser as bundledGrainIntegrationParser,
} from "../../api/bundledGrainIntegrations";
import {toDiscount} from "../../core/ledger/policies/recent";
import stringify from "json-stable-stringify";
import {DiskStorage} from "../../core/storage/disk";
import {loadJsonWithDefault} from "../../util/storage";
import {join as pathJoin} from "path";
import {encode} from "../../core/storage/textEncoding";
import * as NullUtil from "../../util/null";
import {parser, rawParser, type RawGrainConfig} from "../../api/grainConfig";

type OldGrainConfig = {|
  +immediatePerWeek?: NonnegativeGrain, // (deprecated)
  +balancedPerWeek?: NonnegativeGrain, // (deprecated)
  +recentPerWeek?: NonnegativeGrain, // (deprecated)
  +recentWeeklyDecayRate?: number, // (deprecated)
  +allocationPolicies?: $ReadOnlyArray<AllocationConfig>,
  +maxSimultaneousDistributions?: number,
  +sinkIdentity?: Name,
  +processDistributions?: boolean,
  +integration?: GrainIntegration,
|};

export const oldParser: C.Parser<OldGrainConfig> = C.object(
  {},
  {
    allocationPolicies: C.array<AllocationConfig>(allocationConfigParser),
    maxSimultaneousDistributions: C.number,
    immediatePerWeek: numberOrFloatStringParser,
    balancedPerWeek: numberOrFloatStringParser,
    recentPerWeek: numberOrFloatStringParser,
    recentWeeklyDecayRate: C.number,
    sinkIdentity: nameParser,
    processDistributions: C.boolean,
    integration: bundledGrainIntegrationParser,
  }
);

function toDistributionPolicy(x: OldGrainConfig) {
  const allocationPolicies = NullUtil.orElse(x.allocationPolicies, []);
  const POSITIVE_ZERO = toNonnegativeGrain(0);
  const immediatePerWeek = NullUtil.orElse(x.immediatePerWeek, POSITIVE_ZERO);
  const recentPerWeek = NullUtil.orElse(x.recentPerWeek, POSITIVE_ZERO);
  const balancedPerWeek = NullUtil.orElse(x.balancedPerWeek, POSITIVE_ZERO);

  const allocationPoliciesDeprecated = [];
  if (G.gt(immediatePerWeek, G.ZERO)) {
    allocationPoliciesDeprecated.push({
      budget: G.toFloatString(immediatePerWeek),
      policyType: "IMMEDIATE",
      numIntervalsLookback: 1,
    });
  }
  if (G.gt(recentPerWeek, G.ZERO)) {
    const {recentWeeklyDecayRate} = x;
    if (recentWeeklyDecayRate == null) {
      throw new Error(`no recentWeeklyDecayRate specified for recent policy`);
    }
    allocationPoliciesDeprecated.push({
      budget: G.toFloatString(recentPerWeek),
      policyType: "RECENT",
      discount: toDiscount(recentWeeklyDecayRate),
    });
  }
  if (G.gt(balancedPerWeek, G.ZERO)) {
    allocationPoliciesDeprecated.push({
      budget: G.toFloatString(balancedPerWeek),
      policyType: "BALANCED",
      numIntervalsLookback: 0,
    });
  }
  return allocationPolicies.concat(allocationPoliciesDeprecated);
}

export const v0_10_0 = async (): Promise<void> => {
  const storage = new DiskStorage(process.cwd());
  const path = pathJoin("config", "grain.json");
  const oldConfig = await loadJsonWithDefault(
    storage,
    path,
    oldParser,
    () => null
  );
  if (!oldConfig) return;
  const newConfig = transform(oldConfig);
  storage.set(path, encode(stringify(newConfig, {space: 2})));
};

export const transform = (oldConfig: OldGrainConfig): RawGrainConfig => {
  const legacyIntegratedPolicies = toDistributionPolicy(oldConfig);
  const newConfig = buildObject<RawGrainConfig>(
    {
      allocationPolicies: legacyIntegratedPolicies,
    },
    {
      sinkIdentity: oldConfig.sinkIdentity,
      processDistributions: oldConfig.processDistributions,
      integration: oldConfig.integration,
      maxSimultaneousDistributions: oldConfig.maxSimultaneousDistributions,
    }
  );
  //Verification
  parser.parseOrThrow(newConfig);
  rawParser.parseOrThrow(newConfig);
  return newConfig;
};
