// @flow

import * as P from "../../../util/combo";
import {
  type BalancedPolicy,
  type BalancedConfig,
  balancedReceipts,
  balancedPolicyParser,
  balancedConfigParser,
  balancedRawParser,
  toString as toStringBalanced,
} from "./balanced";
import {
  type ImmediatePolicy,
  type ImmediateConfig,
  immediateReceipts,
  immediatePolicyParser,
  immediateConfigParser,
  immediateRawParser,
  toString as toStringImmediate,
} from "./immediate";
import {
  type RecentPolicy,
  type RecentConfig,
  recentReceipts,
  recentPolicyParser,
  recentConfigParser,
  recentRawParser,
  toString as toStringRecent,
} from "./recent";
import {
  type SpecialPolicy,
  type SpecialConfig,
  specialReceipts,
  specialPolicyParser,
  specialConfigParser,
  specialRawParser,
  toString as toStringSpecial,
} from "./special";

export {balancedReceipts, balancedPolicyParser};
export {immediateReceipts, immediatePolicyParser};
export {recentReceipts, recentPolicyParser};
export {specialReceipts, specialPolicyParser};

export type AllocationPolicy =
  | BalancedPolicy
  | ImmediatePolicy
  | RecentPolicy
  | SpecialPolicy;

export type AllocationConfig =
  | BalancedConfig
  | ImmediateConfig
  | RecentConfig
  | SpecialConfig;

// Simply verifies and types what is in a config with no mutations.
export const allocationConfigParser: P.Parser<AllocationConfig> = P.orElse([
  balancedRawParser,
  immediateRawParser,
  recentRawParser,
  specialRawParser,
]);

// Mutates a config into a policy.
export const policyConfigParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedConfigParser,
  immediateConfigParser,
  recentConfigParser,
  specialConfigParser,
]);

// Verifies and possibly mutates a serialized policy into a
// deserialized policy. This is for use with the ledger log.
export const allocationPolicyParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedPolicyParser,
  immediatePolicyParser,
  recentPolicyParser,
  specialPolicyParser,
]);

export function toString(policy: AllocationPolicy): string {
  switch (policy.policyType) {
    case "BALANCED":
      return toStringBalanced(policy);
    case "IMMEDIATE":
      return toStringImmediate(policy);
    case "RECENT":
      return toStringRecent(policy);
    case "SPECIAL":
      return toStringSpecial(policy);
  }
}
