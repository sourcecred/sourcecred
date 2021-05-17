// @flow

import {type NodeAddressT, NodeAddress} from "../graph";
import type {URL, ReferenceDetector} from "./referenceDetector";
import {MappedReferenceDetector} from "./mappedReferenceDetector";

const nodeA = NodeAddress.fromParts(["test", "A"]);
const nodeB = NodeAddress.fromParts(["test", "B"]);
const nodeC = NodeAddress.fromParts(["test", "C"]);

describe("core/references/mappedReferenceDetector", () => {
  describe("MappedReferenceDetector", () => {
    it("should implement the ReferenceDetector interface", () => {
      const _unused_toReferenceDetector = (
        x: MappedReferenceDetector
      ): ReferenceDetector => x;
    });

    it("should return values of exactly matching keys in the map", () => {
      // Given
      const map: Map<URL, NodeAddressT> = new Map([
        ["http://foo.bar/a", nodeA],
        ["http://foo.bar/b", nodeB],
        ["http://foo.bar/c", nodeC],
      ]);

      // When
      const refs = new MappedReferenceDetector(map);
      const n1a = refs.addressFromUrl("http://foo.bar/a");
      const n2a = refs.addressFromUrl("http://foo.bar/b");
      const n3a = refs.addressFromUrl("http://foo.bar/c");
      const n1b = refs.addressFromUrl("https://foo.bar/a");
      const n2b = refs.addressFromUrl("http://foo.bar/b?key=val");
      const n3b = refs.addressFromUrl("http://foo.bar/c#anchor");

      // Then
      expect(n1a).toEqual(nodeA);
      expect(n2a).toEqual(nodeB);
      expect(n3a).toEqual(nodeC);
      expect(n1b).toEqual(undefined);
      expect(n2b).toEqual(undefined);
      expect(n3b).toEqual(undefined);
    });
  });
});
