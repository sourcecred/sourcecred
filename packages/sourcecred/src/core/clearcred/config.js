// @flow

import type {TimestampMs} from "../../util/timestamp";
import type {Contribution, Expression, WeightOperand} from "./contribution";
import type {Operator} from "./operator";

export type WeightConfig = $ReadOnlyArray<{|
  +key: string,
  +default?: number,
  +values: $ReadOnlyArray<{|
    +value: string,
    +weight: number,
  |}>,
|}>;
export type OperatorConfig = $ReadOnlyArray<{|
  +key: string,
  +operator: Operator,
|}>;
export type SharesConfig = $ReadOnlyArray<{|
  +key: string,
  +amount: number,
|}>;
export type Config = {|
  +memo: string,
  +startTimeMs: TimestampMs,
  +weights: WeightConfig,
  +operators: OperatorConfig,
  +shares: SharesConfig,
|};

export function hasExplicitWeight(
  weightOperand: WeightOperand,
  config: Config
): boolean {
  const keyConfig = config.weights.find(
    (x) => x.key === weightOperand.key
  );
  if (keyConfig === undefined)
    throw new Error(
      `Key [${weightOperand.key}] has not been set in the weights config.`
    );
  const valueConfig = keyConfig.values.find(
    (x) => x.value === weightOperand.value
  );
  return valueConfig !== undefined;
}

export function getWeight(
  weightOperand: WeightOperand,
  config: Config
): number {
  const keyConfig = config.weights.find(
    (x) => x.key === weightOperand.key
  );
  if (keyConfig === undefined)
    throw new Error(
      `Key [${weightOperand.key}] has not been set in the weights config.`
    );
  const valueConfig = keyConfig.values.find(
    (x) => x.value === weightOperand.value
  );
  if (!valueConfig) {
    if (keyConfig.default === undefined)
      throw new Error(
        `Key [${weightOperand.key}] does not have the value [${weightOperand.value}] and does not have a default set.`
      );
    return keyConfig.default;
  }
  return valueConfig.weight;
}

export function getShares(
  key: string,
  config: Config
): number {
  return (
    config.shares.find(
      (shareConfig) => shareConfig.key === key
    )?.amount ?? 0
  );
}
