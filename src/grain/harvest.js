// @flow

import {type Grain} from "./grain";
import {type NodeAddressT} from "../core/graph";

export type PayoutStrategy =
  | HistoricalUnderpayment
  | IntervalPayout
  | GrainPerCred;

export type HistoricalUnderpayment = HistoricalUnderpayment_v1;
export type HistoricalUnderpayment_v1 = {|
  +type: "HISTORICAL_UNDERPAYMENT",
  +version: number,
  +amount: Grain,
|};

export type IntervalPayout = IntervalPayout_v1;
export type IntervalPayout_v1 = {|
  +type: "INTERVAL_PAYOUT",
  +version: number,
  +amount: Grain,
  +intervalEndTimeMs: number,
|};

export type GrainPerCred = GrainPerCred_v1;
export type GrainPerCred_v1 = {|
  +type: "GRAIN_PER_CRED",
  +version: number,
  +grainPerCred: number,
|};

export type Harvest_v1 = {|
  +type: "HARVEST",
  +version: number,
  +timestampMs: number,
  +payoutStrategy: PayoutStrategy,
  +receipts: $ReadOnlyArray<{|+address: NodeAddressT, amount: Grain|}>,
|};
