// @flow

import type {WeightOperand} from "./contribution";
import type {WeightConfig} from "./config";

function getWeightConfigs(config, key: string, subkey) {
  const keyConfig = config.find((x) => x.key === key);
  if (keyConfig === undefined)
    throw new Error(`Key [${key}] has not been set in the weights config.`);
  const subkeyConfig = keyConfig.subkeys.find((x) => x.subkey === subkey);
  return {keyConfig, subkeyConfig};
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
