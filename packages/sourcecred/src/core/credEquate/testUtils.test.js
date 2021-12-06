// @flow

import type {Config} from "./config";
import type {WeightOperand} from "./contribution";

export const weightOperands = [
  {memo: "key1", subkey: "2", weight: 3},
  {memo: "key2", subkey: "0", weight: 0},
];

const operatorsConfig = [
  {key: "emoji", operator: "ADD"},
  {key: "roles", operator: "CLEAR"},
];

const config: Config = {
  weights: [
    {
      key: "emoji",
      default: 1,
      subkeys: buildWeightOperands(),
    },
    {
      key: "roles",
      default: 1,
      subkeys: [{subkey: "3", weight: 3}],
    },
    {
      key: "mention",
      default: 1,
      subkeys: [{subkey: "2", weight: 4}],
    },
    {
      key: "3",
      default: 1,
      subkeys: [{subkey: "3", weight: 4}],
    },
  ],
  operators: operatorsConfig,
  shares: [
    {
      key: "author",
      default: 1,
      subkeys: [],
    },
    {
      key: "mentioned",
      default: 2,
      subkeys: [{subkey: "3", weight: 3}],
    },
  ],
  memo: "test",
  startTimeMs: -Infinity,
};

export function buildWeightOperands(): $ReadOnlyArray<{|
  +subkey: string,
  +memo?: string,
  +weight: number,
|}> {
  return weightOperands;
}

export function buildConfig(): Config {
  return config;
}
