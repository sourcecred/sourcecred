//@flow

import type {NodeAddressT} from "../graph";
import type {ReferenceDetector, URL} from "./referenceDetector";

/**
 * A class for composing ReferenceDetectors. Calls ReferenceDetectors in the order
 * they're given in the constructor, returning the first NodeAddressT it encounters.
 */
export class CascadingReferenceDetector implements ReferenceDetector {
  refs: $ReadOnlyArray<ReferenceDetector>;

  constructor(refs: $ReadOnlyArray<ReferenceDetector>) {
    this.refs = refs;
  }

  addressFromUrl(url: URL): ?NodeAddressT {
    for (const ref of this.refs) {
      const addr = ref.addressFromUrl(url);
      if (addr) return addr;
    }
  }
}
