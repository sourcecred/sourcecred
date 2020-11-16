// @flow

import * as P from "../../../util/combo";
import {
  type BalancedPolicy,
  balancedReceipts,
  balancedPolicyParser,
} from "./balanced";
import {
  type ImmediatePolicy,
  immediateReceipts,
  immediatePolicyParser,
} from "./immediate";
import {type RecentPolicy, recentReceipts, recentPolicyParser} from "./recent";
import {
  type SpecialPolicy,
  specialReceipts,
  specialPolicyParser,
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

export const allocationPolicyParser: P.Parser<AllocationPolicy> = P.orElse([
  balancedPolicyParser,
  immediatePolicyParser,
  recentPolicyParser,
  specialPolicyParser,
]);
