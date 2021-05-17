// @flow

import type {NodeAddressT} from "../graph";
import type {ReferenceDetector, URL} from "./referenceDetector";

type TranslateFunction = (NodeAddressT) => ?NodeAddressT;

/**
 * A ReferenceDetector which takes a base ReferenceDetector and applies a
 * translate function to any results.
 */
export class TranslatingReferenceDetector implements ReferenceDetector {
  translate: TranslateFunction;
  base: ReferenceDetector;

  constructor(base: ReferenceDetector, translate: TranslateFunction) {
    this.base = base;
    this.translate = translate;
  }

  addressFromUrl(url: URL): ?NodeAddressT {
    const baseAddr = this.base.addressFromUrl(url);
    if (!baseAddr) return;
    return this.translate(baseAddr);
  }
}
