// @flow

import type {NodeAddressT} from "../../core/graph";
import type {InitiativeRepository} from "./initiative";
import {initiativeAddress} from "./createGraph";
import {
  type ReferenceDetector,
  TranslatingReferenceDetector,
} from "../../core/references";

/**
 * Creates a TranslatingReferenceDetector which translates the NodeAddressT's
 * referring to our Initiative.tracker's and translates them to the Initiative's
 * NodeAddressT.
 */
export function fromTrackerTranslation(
  trackerRefs: ReferenceDetector,
  repo: InitiativeRepository
): TranslatingReferenceDetector {
  // Generate the mapping as: tracker address => initiative address.
  const map: Map<NodeAddressT, NodeAddressT> = new Map();
  for (const initiative of repo.initiatives()) {
    map.set(initiative.tracker, initiativeAddress(initiative));
  }

  // Use a map lookup as the translation function.
  const translate = (addr: NodeAddressT): ?NodeAddressT => map.get(addr);
  return new TranslatingReferenceDetector(trackerRefs, translate);
}
