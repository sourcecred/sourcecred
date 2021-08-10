// @flow

import stringify from "json-stable-stringify";
import * as C from "../../util/combo";
import {Ledger} from "./ledger";
import {
  type Name,
  nameFromString,
  nameParser,
  type Alias,
  aliasParser,
  type IdentityType,
  identityTypeParser,
} from "../identity";
import type {IdentityId} from "../identity";

/**
 * An IdentityProposal allows a plugin to report a participant identity,
 * for inclusion in the ledger.
 *
 * The proposal has an `alias`, which includes a node address for the identity.
 * If some account already has that address, then the proposal may be ignored.
 *
 * If no account has that address, then the proposal will be added as a new
 * identity in the ledger.
 *
 * The proposal has a proposed name for the identity, and a name for the
 * plugin. The plugin name will be used as a discriminator if there's already a
 * different identity with that name.
 *
 * If the name and discriminator combo is taken, then a further numeric
 * discriminator will be added.
 *
 * When the identity is created, it will have its own identity address, per
 * usual, and then the alias will be added. We give the plugin control over the
 * full alias because aliases include helpful descriptions which are shown in
 * the UI, and the plugin should choose an appropriate description.
 */
export type IdentityProposal = {|
  +name: Name,
  +pluginName: Name,
  +alias: Alias,
  +type: IdentityType,
|};

export const parser: C.Parser<IdentityProposal> = C.object({
  name: nameParser,
  pluginName: nameParser,
  alias: aliasParser,
  type: identityTypeParser,
});

export const identityProposalsParser: C.Parser<
  $ReadOnlyArray<IdentityProposal>
> = C.array(parser);

/**
 * Given a Ledger and an IdentityProposal, ensure that some Ledger account
 * exists for the proposed identity and return the identity ID.
 *
 * If there is already an account matching the node address of the proposal's
 * alias, then the ledger is unchanged.
 *
 * Otherwise, a new account will be created per the semantics of the
 * IdentityProposal type.
 */
export function ensureIdentityExists(
  ledger: Ledger,
  proposal: IdentityProposal
): IdentityId {
  const existingAccount = ledger.accountByAddress(proposal.alias.address);
  if (existingAccount != null) {
    // there is already some account that includes this address; do nothing
    return existingAccount.identity.id;
  }
  const name = _chooseIdentityName(proposal, (n) => ledger.nameAvailable(n));
  const id = ledger.createIdentity(proposal.type, name);
  ledger.addAlias(id, proposal.alias);
  return id;
}

const MAX_NUMERIC_DISCRIMINATOR = 100;
export function _chooseIdentityName(
  proposal: IdentityProposal,
  checkAvailability: (Name) => boolean
): Name {
  if (checkAvailability(proposal.name)) {
    return proposal.name;
  }
  const withPluginDiscriminator = nameFromString(
    proposal.name + "-" + proposal.pluginName
  );
  if (checkAvailability(withPluginDiscriminator)) {
    return withPluginDiscriminator;
  }
  for (let i = 1; i < MAX_NUMERIC_DISCRIMINATOR; i++) {
    const withNumericDiscriminator = nameFromString(
      withPluginDiscriminator + "-" + i
    );
    if (checkAvailability(withNumericDiscriminator)) {
      return withNumericDiscriminator;
    }
  }
  throw new Error(`unable to find an identity name for ${stringify(proposal)}`);
}
