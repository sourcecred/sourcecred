//@flow

import type {NodeAddressT} from "../graph";
import type {ReferenceDetector, URL} from "./referenceDetector";

/**
 * A reference detector which uses a pregenerated `Map<URL, NodeAddressT>` as a
 * lookup table.
 *
 * Note: this is sensitive to canonicalization issues because it's based on string
 * comparisons. For example:
 * - "http://foo.bar/123" != "http://foo.bar/123#chapter-2"
 * - "http://foo.bar/?a=1&b=2" != "http://foo.bar/?b=2&a=1"
 * - "http://foo.bar/space+bar" != "http://foo.bar/space%20bar"
 */
export class MappedReferenceDetector implements ReferenceDetector {
  map: Map<URL, NodeAddressT>;

  constructor(map: Map<URL, NodeAddressT>) {
    this.map = map;
  }

  addressFromUrl(url: URL): ?NodeAddressT {
    return this.map.get(url);
  }
}
