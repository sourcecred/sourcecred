// @flow

import {type NodeAddressT, NodeAddress} from "../graph";
import type {URL, ReferenceDetector} from "./referenceDetector";
import {MappedReferenceDetector} from "./mappedReferenceDetector";
import {TranslatingReferenceDetector} from "./translatingReferenceDetector";

const nodeA = NodeAddress.fromParts(["test", "A"]);
const nodeB = NodeAddress.fromParts(["test", "B"]);

function exampleDetector(pairs?: [URL, NodeAddressT][]): ReferenceDetector {
  const map: Map<URL, NodeAddressT> = new Map(pairs);
  const refs = new MappedReferenceDetector(map);
  jest.spyOn(refs, "addressFromUrl");
  return refs;
}

describe("core/references/translatingReferenceDetector", () => {
  describe("TranslatingReferenceDetector", () => {
    it("should implement the ReferenceDetector interface", () => {
      const _unused_toReferenceDetector = (
        x: TranslatingReferenceDetector
      ): ReferenceDetector => x;
    });

    it("should not call translate function when base has no hit", () => {
      // Given
      const base = exampleDetector();
      const translate = jest.fn().mockImplementation(() => nodeB);

      // When
      const refs = new TranslatingReferenceDetector(base, translate);
      const n1 = refs.addressFromUrl("http://foo.bar/miss");

      // Then
      expect(base.addressFromUrl).toBeCalledWith("http://foo.bar/miss");
      expect(translate).toBeCalledTimes(0);
      expect(n1).toEqual(undefined);
    });

    it("should call translate function when base has a hit", () => {
      // Given
      const base = exampleDetector([["http://foo.bar/a", nodeA]]);
      const translate = jest.fn().mockImplementation(() => nodeB);

      // When
      const refs = new TranslatingReferenceDetector(base, translate);
      const n1 = refs.addressFromUrl("http://foo.bar/a");

      // Then
      expect(base.addressFromUrl).toBeCalledWith("http://foo.bar/a");
      expect(translate).toBeCalledWith(nodeA);
      expect(n1).toEqual(nodeB);
    });
  });
});
