//@flow

import type {NodeAddressT} from "../graph";

export type URL = string;

/**
 * A service which provides reference detection features.
 */
export interface ReferenceDetector {
  /**
   * Tries to infer the node address from an absolute URL.
   * Returning undefined when the detector isn't aware of how to resolve this URL.
   *
   * Note: the detector should only return results that have been verified to exist
   * in it's respective data layer.
   */
  addressFromUrl(url: URL): ?NodeAddressT;
}
