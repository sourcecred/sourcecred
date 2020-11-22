// @flow

import * as P from "../../../util/combo";
import {
  type Balanced,
  type BalancedPolicy,
  balancedReceipts,
  balancedPolicyParser,
} from "./balanced";
import {
  type Immediate,
  type ImmediatePolicy,
  immediateReceipts,
  immediatePolicyParser,
} from "./immediate";
import {
  type Recent,
  type RecentPolicy,
  recentReceipts,
  recentPolicyParser,
} from "./recent";
import {
  type Special,
  type SpecialPolicy,
  specialReceipts,
  specialPolicyParser,
} from "./special";

export {balancedReceipts, balancedPolicyParser};
export {immediateReceipts, immediatePolicyParser};
export {recentReceipts, recentPolicyParser};
export {specialReceipts, specialPolicyParser};

export type AllocationPolicyType = Balanced | Immediate | Recent | Special;

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
