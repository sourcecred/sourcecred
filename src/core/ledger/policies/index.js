// @flow

import * as P from "../../../util/combo";
import {
  type BalancedPolicy,
  balancedReceipts,
  balancedPolicyParser,
  balancedConfigParser,
} from "./balanced";
import {
  type ImmediatePolicy,
  immediateReceipts,
  immediatePolicyParser,
  immediateConfigParser,
} from "./immediate";
import {
  type RecentPolicy,
  recentReceipts,
  recentPolicyParser,
  recentConfigParser,
} from "./recent";
import {
  type SpecialPolicy,
  specialReceipts,
  specialPolicyParser,
  specialConfigParser,
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

export const allocationPolicyParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedPolicyParser,
  immediatePolicyParser,
  recentPolicyParser,
  specialPolicyParser,
]);
