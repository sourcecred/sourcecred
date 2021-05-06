// @flow

import {
  type IdentityId,
  type Name,
  identityIdParser,
  nameParser,
} from "../../core/identity";
import {type Ledger} from "../../core/ledger/ledger";
import {
  type TimestampISO,
  timestampISOParser,
  fromISO,
} from "../../util/timestamp";
import * as C from "../../util/combo";
import {type PersonalAttributions} from "../../core/credrank/personalAttribution";

/**
  This type resembles the JSON schema for configuring personal attributions,
  which allows participants to attribute their cred to other participants.
  This feature should not be used to make cred sellable/transferable, but
  instead is intended to allow participants to acknowledge that a portion of
  their credited outputs are directly generated/supported by the labor of
  others. (e.g. when a contributor has a personal assistant working behind the 
  scenes)
 */
export type PersonalAttributionsConfig = Array<{|
  // The name of a participant that is flowing cred to others
  fromParticipantName: Name,
  // The id of the participant. Will be autopopulated if absent.
  fromParticipantId?: IdentityId,
  +recipients: Array<{|
    // The name of a participant that is receiving cred
    // from the "fromParticipant"
    toParticipantName: Name,
    // The id of the participant. Will be autopopulated if absent.
    toParticipantId?: IdentityId,
    // A chronological log of changes to the proportion of cred flowing from the
    // fromParticipant to the toParticipant each epoch. Each proportion
    // continues to be in effect each epoch until a new proportion takes effect.
    +proportions: Array<{|
      // The Month/Day/Year that the decimalProportion should take effect,
      // e.g. "1/30/2021"
      +startDate: TimestampISO,
      // The 0-1 representation of the percentage of cred that should flow from
      // the fromParticipant to the toParticipant each epoch
      +decimalProportion: number,
    |}>,
  |}>,
|}>;

/**
  Adds the IdentityIds where only IdentityNames are provide, and updates names
  and ids to reflect the account's current identity after merging/renaming.
 */
export function updatePersonalAttributionsConfig(
  config: PersonalAttributionsConfig,
  ledger: Ledger
): PersonalAttributionsConfig {
  return config.map(({fromParticipantId, fromParticipantName, recipients}) => {
    const id = fromParticipantId
      ? ledger.account(fromParticipantId).identity.id
      : ledger.accountByName(fromParticipantName)?.identity.id;
    if (!id) throw new Error(`${fromParticipantName} does not exist.`);
    const name = ledger.account(id).identity.name;
    return {
      fromParticipantId: id,
      fromParticipantName: name,
      recipients: recipients.map(
        ({toParticipantId, toParticipantName, proportions}) => {
          const id = toParticipantId
            ? ledger.account(toParticipantId).identity.id
            : ledger.accountByName(toParticipantName)?.identity.id;
          if (!id) throw new Error(`${toParticipantName} does not exist.`);
          const name = ledger.account(id).identity.name;
          return {
            toParticipantId: id,
            toParticipantName: name,
            proportions,
          };
        }
      ),
    };
  });
}

export function toPersonalAttributions(
  config: PersonalAttributionsConfig
): PersonalAttributions {
  return config.map(({fromParticipantId, recipients}) => {
    if (!fromParticipantId)
      throw new Error("PersonalAttributionConfig must be updated before use.");
    return {
      fromParticipantId,
      recipients: recipients.map(({toParticipantId, proportions}) => {
        if (!toParticipantId)
          throw new Error(
            "PersonalAttributionConfig must be updated before use."
          );
        return {
          toParticipantId,
          proportions: proportions.map(({startDate, decimalProportion}) => ({
            timestampMs: fromISO(startDate),
            proportionValue: decimalProportion,
          })),
        };
      }),
    };
  });
}

const proportionParser = C.fmap(C.number, (n) => {
  if (n < 0 || n > 1) {
    throw new Error(`Proportion ${n} is not in range [0,1]`);
  }
  return n;
});

export const personalAttributionsConfigParser: C.Parser<PersonalAttributionsConfig> = C.array(
  C.object(
    {
      fromParticipantName: nameParser,
      recipients: C.array(
        C.object(
          {
            toParticipantName: nameParser,
            proportions: C.array(
              C.object({
                startDate: timestampISOParser,
                decimalProportion: proportionParser,
              })
            ),
          },
          {
            toParticipantId: identityIdParser,
          }
        )
      ),
    },
    {fromParticipantId: identityIdParser}
  )
);
