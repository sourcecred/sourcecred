// @flow

import {
  type TimestampMs,
  timestampISOParser,
  fromISO,
} from "../../util/timestamp";
import type {WeightOperand} from "./contribution";
import {
  type Operator,
  type OperatorOrKey,
  OPERATOR_KEY_PREFIX,
  OPERATORS,
  operatorParser,
} from "./operator";
import * as C from "../../util/combo";

/**
Semantically, allows weight configuration of different qualities/characteristics of
contributions.

Technically, a once-nested key-value store that maps key-subkey pairs to weights and
specifies a default weight at the key-level that can be used when a queried subkey
is not found.

A Discord-based example might look like: 
{
  "key": "channel",
  "default": 1,
  "subkeys": [
    { "subkey": "12345678", memo: "props", weight: 3 }
  ]
}
 */
export type WeightConfig = $ReadOnlyArray<{|
  /** Arbitrary string enumerated by a plugin developer. */
  +key: string,
  /** The weight used when a queried subkey is not found. */
  +default: number,
  /** A key-value store mapping platform-based identifiers to weights. */
  +subkeys: $ReadOnlyArray<{|
    /** Potentially arbitrary, but most likely a platform-specific identifier */
    +subkey: string,
    /** An optional human-readable description of the subkey */
    +memo?: string,
    /** An algebraic constant/coefficient that defines the semantic value of
    the subkey */
    +weight: number,
  |}>,
|}>;
const weightConfigParser = C.array(
  C.object({
    key: C.string,
    default: C.number,
    subkeys: C.array(
      C.object(
        {
          subkey: C.string,
          weight: C.number,
        },
        {
          memo: C.string,
        }
      )
    ),
  })
);
/**
A key-value store of configured operators, allowing the configuration of
operators within an expression. For example, one might be able to
configure that emoji reactions be added or multiplied.
 */
export type OperatorConfig = $ReadOnlyArray<{|
  /** Arbitrary string enumerated by a plugin developer. NOT prefixed. */
  +key: string,
  /** The operator that should be applied wherever the key is found. */
  +operator: Operator,
|}>;
const operatorConfigParser = C.array(
  C.object({
    key: C.string,
    operator: operatorParser,
  })
);

/**
Wraps the other config types, and defines a time scope via a start timestamp.
The end timestamp will be inferred as the next highest timestamp in an array
of Configs.
 */
export type Config = {|
  /** A note or a human-readable description to make it easier to recognize this config. **/
  +memo: string,
  +startTimeMs: TimestampMs,
  +weights: WeightConfig,
  +operators: OperatorConfig,
  +shares: WeightConfig,
|};

function getWeightConfigs(config, key: string, subkey) {
  const keyConfig = config.find((x) => x.key === key);
  if (keyConfig === undefined)
    throw new Error(`Key [${key}] has not been set in the weights config.`);
  const subkeyConfig = keyConfig.subkeys.find((x) => x.subkey === subkey);
  return {keyConfig, subkeyConfig};
}

/**
Groups Configs together by target strings that may represent
a server ID/endpoint, a repository name, etc.
 */
export type ConfigsByTarget = {[string]: $ReadOnlyArray<Config>};

export const configsByTargetParser: C.Parser<ConfigsByTarget> = C.dict(
  C.array(
    C.object({
      memo: C.string,
      startDate: timestampISOParser.fmap((t) => fromISO(t)),
      weights: weightConfigParser,
      operators: operatorConfigParser,
      shares: weightConfigParser,
    }).fmap(({memo, startDate, weights, operators, shares}) => ({
      memo,
      weights,
      operators,
      shares,
      startTimeMs: startDate,
    }))
  ),
  C.string
);

/**
Returns true if the subkey exists in the subkeys array of the key.
Returns false if the subkey does not exist in the subkeys array.
Throws if the key has not been set in the configuration.
 */
export function hasExplicitWeight(
  {key, subkey}: WeightOperand,
  config: WeightConfig
): boolean {
  const {subkeyConfig} = getWeightConfigs(config, key, subkey);
  return subkeyConfig !== undefined;
}

/**
If the subkey is found, returns the subkey's weight.
If the subkey is not found, returns the key's default.
Throws if the key has not been set in the configuration.
 */
export function getWeight(
  {key, subkey}: WeightOperand,
  config: WeightConfig
): number {
  const {keyConfig, subkeyConfig} = getWeightConfigs(config, key, subkey);
  if (!subkey || !subkeyConfig) return keyConfig.default;
  return subkeyConfig.weight;
}

/**
Takes a prefixed key and returns the configured operator queried by the
non-prefixed key.
Throws if the input is not properly prefixed.
Throws if the key has not been set in the configuration.
Throws if the configured operator is not a valid operator.
 */
export function getOperator(rawKey: OperatorOrKey, config: Config): Operator {
  if (!rawKey.startsWith(OPERATOR_KEY_PREFIX))
    throw new Error(
      `Invalid expression operator [${rawKey}]. This is probably a bug in the plugin. Valid operators are ${OPERATORS.toString()} and operator keys should be prefixed with '${OPERATOR_KEY_PREFIX}'`
    );
  const key = rawKey.slice(OPERATOR_KEY_PREFIX.length);
  const operator = config.operators.find(
    (operatorConfig) => key === operatorConfig.key
  )?.operator;
  if (!operator)
    throw new Error(
      `Operator for key [${key}] has not been set in the operators config.`
    );
  if (!OPERATORS.includes(operator))
    throw new Error(
      `Operator [${operator}] for Key [${key}] is an invalid configuration. Please choose from ${OPERATORS.toString()}.`
    );
  return operator;
}

/**
Utility function for getting the earliest start time of all configs in an array
of ConfigsByTarget.
 */
export function getEarliestStartForConfigs(
  configsByTargetArray: $ReadOnlyArray<ConfigsByTarget>
): TimestampMs {
  let startTimeMs = Infinity;
  configsByTargetArray.forEach((configsByTarget) => {
    const arr = [];
    for (const key of Object.keys(configsByTarget)) {
      configsByTarget[key].map((config) => {
        if (config.startTimeMs < startTimeMs) startTimeMs = config.startTimeMs;
      });
    }
    return arr;
  });
  if (startTimeMs === Infinity)
    throw new Error(
      "Could not find earliest start time because there are no configs."
    );
  return startTimeMs;
}
