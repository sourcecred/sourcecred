// @flow

import type {TimestampMs} from "../../util/timestamp";
import type {Contribution, Expression, WeightOperand} from "./contribution";
import {type Operator, OPERATOR_KEY_PREFIX, OPERATORS} from "./operator";

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
/**
A key-value store of how many shares different types of participation are worth.
Shares are arbitrary numbers that compete in a zero-sum divvying of a
ScoredContribution's score.
 */
export type SharesConfig = $ReadOnlyArray<{|
  /** Arbitrary string enumerated by a plugin developer. */
  +key: string,
  /**
  Number of shares allocated for the participation type indicated by the
  key. Will be scored relative to the other share amounts within a contribution.
  */
  +amount: number,
|}>;

/**
Wraps the other config types, and defines a time scope via a start timestamp.
The end timestamp will be inferred as the next highest timestamp in an array
of Configs.
 */
export type Config = {|
  +memo: string,
  +startTimeMs: TimestampMs,
  +weights: WeightConfig,
  +operators: OperatorConfig,
  +shares: SharesConfig,
|};

/**
Returns true if the subkey exists in the subkeys array of the key.
Returns false if the subkey does not exist in the subkeys array.
Throws if the key has not been set in the configuration.
 */
export function hasExplicitWeight(
  {key, subkey}: WeightOperand,
  config: Config
): boolean {
  const keyConfig = config.weights.find((x) => x.key === key);
  if (keyConfig === undefined)
    throw new Error(`Key [${key}] has not been set in the weights config.`);
  const subkeyConfig = keyConfig.subkeys.find((x) => x.subkey === subkey);
  return subkeyConfig !== undefined;
}

/**
If the subkey is found, returns the subkey's weight.
If the subkey is not found, returns the key's default.
Throws if the key has not been set in the configuration.
 */
export function getWeight(
  {key, subkey}: WeightOperand,
  config: Config
): number {
  const keyConfig = config.weights.find((x) => x.key === key);
  if (keyConfig === undefined)
    throw new Error(`Key [${key}] has not been set in the weights config.`);
  const subkeyConfig = keyConfig.subkeys.find((x) => x.subkey === subkey);
  if (!subkeyConfig) {
    return keyConfig.default;
  }
  return subkeyConfig.weight;
}

/**
Takes a prefixed key and returns the configured operator queried by the
non-prefixed key.
Throws if the input is not properly prefixed.
Throws if the key has not been set in the configuration.
Throws if the configured operator is not a valid operator.
 */
export function getOperator(rawKey: string, config: Config): Operator {
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
Returns the amount set for the key.
Throws if the key has not been set in the configuration.
 */
export function getShares(key: string, config: Config): number {
  const amount = config.shares.find((shareConfig) => shareConfig.key === key)
    ?.amount;
  if (!amount)
    throw new Error(
      `Shares for key [${key}] has not been set in the operators config.`
    );
  return amount;
}
