// @flow

import {
  type IntervalLength,
  type Budget,
  type BudgetPeriod,
  intervalLengthParser,
} from "../core/mintBudget";
import {
  type PluginId,
  parser as pluginIdParser,
  fromString as pluginIdFromString,
} from "./pluginId";
import {
  type TimestampISO,
  fromISO,
  timestampISOParser,
} from "../util/timestamp";
import * as C from "../util/combo";
import {getPluginDeclaration} from "./bundledDeclarations";
import {DataStorage} from "../core/storage";

/**
 * This module contains logic for setting Cred minting budgets over time on a per-plugin basis.
 * As an example, suppose we want to limit the GitHub plugin to mint only 200 Cred per week,
 * and we want the Discord plugin to mint 100 Cred per Week until Jan 1, 2020 and 200 Cred per
 * week thereafter. We could do so with the following config:
 * ```json
 * {
 *   "intervalLength": "WEEKLY",
 *   "plugins": {
 *     "sourcecred/github": [
 *        {"startTime": "2018-01-01", "budget": 200}
 *     ],
 *     "sourcecred/discord": [
 *       {"startTime": "2018-01-01", "budget": 100},
 *       {"startTime": "2020-01-01", "budget": 200},
 *     ],
 *   }
 * }
 * ```
 */

type RawPluginBudgetConfig = {|
  +intervalLength: IntervalLength,
  +plugins: {[PluginId]: $ReadOnlyArray<RawBudgetPeriod>},
|};

type RawBudgetPeriod = {|
  +startTime: TimestampISO,
  +budget: number,
|};

const rawPeriodParser: C.Parser<RawBudgetPeriod> = C.object({
  startTime: timestampISOParser,
  budget: C.number,
});

export const rawParser: C.Parser<RawPluginBudgetConfig> = C.object({
  intervalLength: intervalLengthParser,
  plugins: C.dict(C.array(rawPeriodParser), pluginIdParser),
});

function upgradeRawPeriod(p: RawBudgetPeriod): BudgetPeriod {
  return {budgetValue: p.budget, startTimeMs: fromISO(p.startTime)};
}

export async function upgrade(
  config: RawPluginBudgetConfig,
  storage: DataStorage
): Promise<Budget> {
  const entries = await Promise.all(
    Object.keys(config.plugins).map(async (key) => {
      const id = pluginIdFromString(key);
      const declaration = await getPluginDeclaration(id, storage);
      if (id == null) {
        throw new Error(`No available plugin with id ${id}`);
      }
      const prefix = declaration.nodePrefix;
      const periods = config.plugins[id].map(upgradeRawPeriod);
      return {prefix, periods};
    })
  );
  return {entries, intervalLength: config.intervalLength};
}
