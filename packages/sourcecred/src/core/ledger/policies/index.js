// @flow

import * as P from "../../../util/combo";
import {
  type BalancedPolicy,
  balancedReceipts,
  balancedPolicyParser,
  balancedConfigParser,
  toString as toStringBalanced,
} from "./balanced";
import {
  type ImmediatePolicy,
  immediateReceipts,
  immediatePolicyParser,
  immediateConfigParser,
  toString as toStringImmediate,
} from "./immediate";
import {
  type RecentPolicy,
  recentReceipts,
  recentPolicyParser,
  recentConfigParser,
  toString as toStringRecent,
} from "./recent";
import {
  type SpecialPolicy,
  specialReceipts,
  specialPolicyParser,
  specialConfigParser,
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

export const policyConfigParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedConfigParser,
  immediateConfigParser,
  recentConfigParser,
  specialConfigParser,
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

export const allocationPolicyParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedPolicyParser,
  immediatePolicyParser,
  recentPolicyParser,
  specialPolicyParser,
]);
