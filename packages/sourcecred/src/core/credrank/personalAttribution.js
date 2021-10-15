// @flow

import findLast from "lodash.findlast";
import {type IdentityId, identityIdParser} from "../identity/id";
import type {TimestampMs} from "../../util/timestamp";
import * as C from "../../util/combo";

/**
  This module allows participants to attribute their cred to other participants.
  This feature should not be used to make cred sellable/transferable, but
  instead is intended to allow participants to acknowledge that a portion of
  their creditted outputs are directly generated/supported by the labor of
  others. (e.g. when a contributor has a personal assistant working behind the 
  scenes)
*/

/** 
  A timestamped configuration representing a decimal proportion of cred flow,
  which can be applied to a participant pair.
*/
export type PersonalAttributionProportion = {|
  // The start time from which epochs should begin using the proportion
  +timestampMs: TimestampMs,
  // decimal proportion (0-1) of cred that should flow between 2 participants
  +proportionValue: number,
|};
/**
  A recipient of cred attribution and a chronological log of proportion
  configurations.
 */
export type AttributionRecipient = {|
  +toParticipantId: IdentityId,
  +proportions: $ReadOnlyArray<PersonalAttributionProportion>,
|};
/**
  A participant that is attributing their cred, and a log of how they are
  attributing it.
 */
export type PersonalAttribution = {|
  +fromParticipantId: IdentityId,
  +recipients: $ReadOnlyArray<AttributionRecipient>,
|};
/**
  A list of participants who are attributing their cred, with logs of how
  they are attributing it.
 */
export type PersonalAttributions = $ReadOnlyArray<PersonalAttribution>;
export const personalAttributionsParser: C.Parser<PersonalAttributions> =
  C.array(
    C.object({
      fromParticipantId: identityIdParser,
      recipients: C.array(
        C.object({
          toParticipantId: identityIdParser,
          proportions: C.array(
            C.object({timestampMs: C.number, proportionValue: C.number})
          ),
        })
      ),
    })
  );

/**
  Validates that:
  1. There is only 1 entry per fromParticipantId.
  1. Each fromParticipantId only has 1 entry per toParticipantId.
  2. Proportions are in chronological order.
  3. Proportions are a number between 0 and 1.
*/
export function validatePersonalAttributions(
  personalAttributions: PersonalAttributions
) {
  personalAttributions.forEach((pa, index) => {
    if (
      personalAttributions.findIndex(
        (x) => x.fromParticipantId === pa.fromParticipantId
      ) !== index
    )
      throw `More than one PersonalAttribution object found with fromParticipantId [${pa.fromParticipantId}]`;
    pa.recipients.forEach((ar, index) => {
      if (
        pa.recipients.findIndex(
          (x) => x.toParticipantId === ar.toParticipantId
        ) !== index
      )
        throw `More than one AttributionRecipient object found with toParticipantId [${ar.toParticipantId}] for fromParticipantId [${pa.fromParticipantId}] `;
      ar.proportions.forEach((proportion, index) => {
        if (
          index > 0 &&
          proportion.timestampMs < ar.proportions[index - 1].timestampMs
        )
          throw `Personal Attribution proportions not in chronological order for [${pa.fromParticipantId}] to [${ar.toParticipantId}]`;
        if (proportion.proportionValue < 0 || 1 < proportion.proportionValue)
          throw `Personal Attribution proportion value must be between 0 and 1, inclusive. Found [${proportion.proportionValue}].`;
      });
    });
  });
}

/**
  This is the intermediary data structure used to index personal attributions
  data, making lookups faster. It can be interpreted as:

  $ReadOnlyMap<
    fromParticipantId,
    $ReadOnlyMap<toParticipantId, AttributionRecipient>
  >
 */
type Index = $ReadOnlyMap<
  IdentityId,
  $ReadOnlyMap<IdentityId, AttributionRecipient>
>;

/**
  An indexed store of PersonalAttributions that includes optimized queries
  needed by credrank.
 */
export class IndexedPersonalAttributions {
  _index: Index;

  /**
    Validates and indexes the input.
  */
  constructor(
    personalAttributions: PersonalAttributions,
    epochStarts: $ReadOnlyArray<TimestampMs>
  ) {
    validatePersonalAttributions(personalAttributions);
    this._index = this._getIndexFromList(personalAttributions);
    this._validateIndex(this._index, epochStarts);
  }

  _getIndexFromList(personalAttributions: PersonalAttributions): Index {
    const index = new Map();
    for (const personalAttribution of personalAttributions) {
      const recipientsIndex = new Map();
      for (const attributionRecipient of personalAttribution.recipients) {
        recipientsIndex.set(
          attributionRecipient.toParticipantId,
          attributionRecipient
        );
      }
      index.set(personalAttribution.fromParticipantId, recipientsIndex);
    }
    return index;
  }

  /**
    Validates that:
    1. No participant is attributing more than 100% of their cred in any epoch.
  */
  _validateIndex(index: Index, epochStarts: $ReadOnlyArray<TimestampMs>) {
    for (const recipientsIndex of index.values()) {
      for (const epochStart of epochStarts) {
        const sum = this._getSumProportionValue(
          epochStart,
          Array.from(recipientsIndex.values())
        );
        if (sum && sum > 1)
          throw `Sum of Personal Attributions for epoch [${epochStart}] is greater than 1. Found: [${sum}].`;
      }
    }
  }

  /**
    Returns a non-indexed, json-friendly PersonalAttributions. The order
    may be changed from the original PersonalAttributions that was used to
    construct this object, but the elements are the same and the order is
    generated consistently.
   */
  toPersonalAttributions(): PersonalAttributions {
    return Array.from(this._index.entries()).map(
      ([fromParticipantId, recipientsIndex]) => {
        return {
          fromParticipantId,
          recipients: Array.from(recipientsIndex.values()),
        };
      }
    );
  }

  /**
    Return the IDs of all of the recipients that receive a non-zero proportion
    of the given participant's cred in the given epoch.
   */
  recipientsForEpochAndParticipant(
    epochStart: TimestampMs,
    fromParticipantId: IdentityId
  ): $ReadOnlyArray<IdentityId> {
    const recipientsIndex = this._index.get(fromParticipantId);
    if (!recipientsIndex) return [];
    return Array.from(recipientsIndex.values())
      .filter(({proportions}) =>
        this._getProportionValue(epochStart, proportions)
      )
      .map(({toParticipantId}) => toParticipantId);
  }

  /**
    Returns the decimal proportion of the fromParticipant's cred that should 
    flow to the toParticipant in the given epoch.
   */
  getProportionValue(
    epochStart: TimestampMs,
    fromParticipantId: IdentityId,
    toParticipantId: IdentityId
  ): number | null {
    const recipientsIndex = this._index.get(fromParticipantId);
    if (!recipientsIndex)
      throw `Could not find PersonalAttribution from [${fromParticipantId}]`;

    const attributionRecipient = recipientsIndex.get(toParticipantId);
    if (!attributionRecipient)
      throw `Could not find AttributionRecipient from [${fromParticipantId}] to [${toParticipantId}]`;

    return this._getProportionValue(
      epochStart,
      attributionRecipient.proportions
    );
  }

  _getProportionValue(
    epochStart: TimestampMs,
    proportions: $ReadOnlyArray<PersonalAttributionProportion>
  ): number | null {
    if (proportions.length && epochStart < proportions[0].timestampMs)
      return null;
    const relevantProportion = findLast(
      proportions,
      (proportion) => proportion.timestampMs <= epochStart
    );
    return relevantProportion ? relevantProportion.proportionValue : null;
  }

  /**
    Returns the total decimal proportion of the fromParticipant's cred that 
    should flow to other participants in the given epoch.
   */
  getSumProportionValue(
    epochStart: TimestampMs,
    fromParticipantId: IdentityId
  ): number | null {
    const recipientsIndex = this._index.get(fromParticipantId);
    if (!recipientsIndex) return null;
    return this._getSumProportionValue(
      epochStart,
      Array.from(recipientsIndex.values())
    );
  }

  _getSumProportionValue(
    epochStart: TimestampMs,
    attributionRecipients: $ReadOnlyArray<AttributionRecipient>
  ): number | null {
    const proportionValues = attributionRecipients
      .map(({proportions}) => this._getProportionValue(epochStart, proportions))
      .filter((proportionValue) => proportionValue !== null);
    if (proportionValues.length === 0) return null;
    return proportionValues.reduce((a, b) => (b ? a + b : a), 0);
  }
}
