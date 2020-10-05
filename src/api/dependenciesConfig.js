// @flow

/**
 * This module defines configuration for the Dependencies system, a system
 * which allows a project to mint excess Cred for its dependencies.
 *
 * To learn about the semantics of the dependencies system, read the module
 * docstring for core/dependenciesMintPolicy.js
 *
 * At a high level, this config type allows the instance maintainer to specify
 * identities (usually PROJECT-type identities) to mint extra Cred over time,
 * as a fraction of the baseline instance Cred.
 *
 * In the future, we'll likely build a UI to manage this config. However, right
 * now it's designed for hand-editability. Also, we really want to be able to
 * ship a default config that adds a SourceCred account (if one doesn't already
 * exist), activates it (if it was just created), and then flows it some Cred.
 *
 * With that in mind, here's how the config works:
 * - User makes a new config, specifying a name for the identity. The user does
 *   not manually write in an id.
 * - The config is validated against the ledger. If the config has an id, we
 *   verify that there's a matching identity in the ledger with that name
 *   (erroring if not). If the config doesn't have an id, we check if there is
 *   an identity in the ledger with that name. If there is, we write the id
 *   into the config. If there isn't, we create a new identity with the name,
 *   activate it (if told to do so by the config), and then write the id into
 *   the config.
 * - Afterwards, we save the config (which is guaranteed to have an id) back to
 *   disk.
 *
 * You'll note that the state in the config is a mix of human generated
 * (choosing the name) and automatically maintained (the id). It's something of
 * a weird compromise, but it accomplishes the design objective of having state
 * that's easy for humans to write by hand, but also tracks the vital
 * information by identity id (which is immutable) rather than by name (which
 * is re-nameable).
 *
 * Note that at present, when the identity in question is re-named, the config
 * must be manually updated to account for the rename. In the future (when the
 * config is automatically maintained) we'll remove this requirement. (Likely
 * we'll stop tracking the identities by name at all in the config; that's an
 * affordance to make the files generatable by hand.)
 */
import * as C from "../util/combo";
import {Ledger} from "../ledger/ledger";
import {
  type TimestampISO,
  timestampISOParser,
  fromISO,
  toISO,
} from "../util/timestamp";
import {type IdentityId, type Name, nameParser} from "../ledger/identity";
import {parser as uuidParser} from "../util/uuid";
import {type DependencyMintPolicy} from "../core/dependenciesMintPolicy";

// A finite nonnegative value (usually in range [0, 1]) which specifies how
// much extra Cred to mint for a given dependency, as a proportion of the raw
// contributor Cred in the instance. Thus, if a dependency has a weight of 0.1,
// then extra Cred will be minted for the dependency equal to 10% of the raw Cred
// in the instance. (Raw Cred being Cred before doing any dependency minting.)
export type DependencyWeight = number;

export type DependencyConfig = {|
  // The id of the dependency in the ledger. If unset, it will be set automatically
  // the first time the dependency config is used in cred analysis.
  +id?: IdentityId,
  // The Name of the dependency in question. This is intended as a convenience
  // for the user; the user can write in a name here, and it will be used to
  // automatically add the dependency to the ledger (if needed) and then to
  // automatically add the id to the config.
  //
  // If the id is set on the config, and the name doesn't match the identity name
  // in the ledger, an error will be thrown. This is to prevent users from changing
  // the name here in the config and (incorrectly) believing that suffices to start
  // flowing Cred to a new identity, after the id has already been set.
  //
  // Thus, if the dependency identity is re-named in the ledger, this file will
  // also need to be edited to reflect the new name.
  +name: Name,
  // The time periods for which we're minting Cred. Each period has a start time and a
  // mint weight; it is assumed to end as soon as the next period begins.
  +periods: $ReadOnlyArray<MintPeriod>,
  // Whether the dependency should be "active" for Grain collection by default.
  // If this is true, then when the corresponding account is auto-created in the
  // ledger, it will also be automatically activated.
  // (Mostly included so we can have SourceCred default opt-in to receiving Grain
  // in new instances.)
  // Defaults to false if unset.
  +autoActivateOnIdentityCreation?: boolean,

  // If this is set, then a default time period will be injected in the
  // dependency config with the weight set to this value (e.g. 0.05 = 5% additional cred minted).
  // (Mostly included so we can have SourceCred receiving cred by default)
  // Does not inject a starting period if unset.
  +autoInjectStartingPeriodWeight?: number,
|};

export type MintPeriod = {|
  +startTime: TimestampISO,
  +weight: number,
|};

export const mintPeriodParser: C.Parser<MintPeriod> = C.object({
  startTime: timestampISOParser,
  weight: C.number,
});

function checkWeightValid(x: number): number {
  if (x < 0) throw new Error(`must be a non-negative number, got ${x}`);
  return x;
}

export const dependencyConfigParser: C.Parser<DependencyConfig> = C.object(
  {
    name: nameParser,
    periods: C.array(mintPeriodParser),
  },
  {
    id: uuidParser,
    autoActivateOnIdentityCreation: C.boolean,
    autoInjectStartingPeriodWeight: C.fmap(C.number, checkWeightValid),
  }
);

export type DependenciesConfig = $ReadOnlyArray<DependencyConfig>;
export const parser: C.Parser<DependenciesConfig> = C.array(
  dependencyConfigParser
);

export function ensureIdentityExists(
  dep: DependencyConfig,
  ledger: Ledger
): DependencyConfig {
  const depId = dep.id;
  if (depId == null) {
    const existingAccount = ledger.accountByName(dep.name);
    if (existingAccount != null) {
      // Already created an account; let's just return a config with the id
      // set.
      const id = existingAccount.identity.id;
      return {...dep, id};
    } else {
      // Create a new Identity for this dependency.
      const id = ledger.createIdentity("PROJECT", dep.name);
      if (dep.autoActivateOnIdentityCreation) {
        ledger.activate(id);
      }
      const weight = dep.autoInjectStartingPeriodWeight;
      if (weight != null && !dep.periods.length) {
        return {
          ...dep,
          id,
          periods: [
            {
              "startTime": toISO(Date.now()),
              weight,
            },
          ],
        };
      }
      return {...dep, id};
    }
  } else {
    // Will throw if the id is not in the ledger.
    const identity = ledger.account(depId).identity;
    if (identity.name !== dep.name) {
      throw new Error(
        `dependency name discrepancy: dep has name ${dep.name} in ` +
          `config, but name ${identity.name} in the ledger. ` +
          `if you deliberately renamed this dep in the ledger, please re-name it in the config as well.`
      );
    }
    return dep;
  }
}

export function toDependencyPolicy(
  config: DependencyConfig,
  ledger: Ledger
): DependencyMintPolicy {
  const {id} = config;
  if (id == null) {
    throw new Error(
      `cannot convert config to policy before it has an id. ensureIdentityExists must be called first.`
    );
  }
  const address = ledger.account(id).identity.address;
  const periods = config.periods.map(({startTime, weight}) => ({
    weight,
    startTimeMs: fromISO(startTime),
  }));
  return {address, periods};
}
