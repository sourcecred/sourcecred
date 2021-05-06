// @flow

import {type NodeAddressT, NodeAddress} from "../graph";
import type {URL, ReferenceDetector} from "./referenceDetector";
import {MappedReferenceDetector} from "./mappedReferenceDetector";
import {CascadingReferenceDetector} from "./cascadingReferenceDetector";

const nodeA = NodeAddress.fromParts(["test", "A"]);
const nodeB = NodeAddress.fromParts(["test", "B"]);
const nodeC = NodeAddress.fromParts(["test", "C"]);

function exampleDetector(pairs?: [URL, NodeAddressT][]): ReferenceDetector {
  const map: Map<URL, NodeAddressT> = new Map(pairs);
  const refs = new MappedReferenceDetector(map);
  jest.spyOn(refs, "addressFromUrl");
  return refs;
}

describe("core/references/cascadingReferenceDetector", () => {
  describe("CascadingReferenceDetector", () => {
    it("should implement the ReferenceDetector interface", () => {
      const _unused_toReferenceDetector = (
        x: CascadingReferenceDetector
      ): ReferenceDetector => x;
    });

    it("should try all ReferenceDetectors to look for a hit", () => {
      // Given
      const refs1 = exampleDetector();
      const refs2 = exampleDetector();
      const refs3 = exampleDetector();

      // When
      const refs = new CascadingReferenceDetector([refs1, refs2, refs3]);
      const n1 = refs.addressFromUrl("http://foo.bar/miss");

      // Then
      expect(refs1.addressFromUrl.mock.calls).toEqual([
        ["http://foo.bar/miss"],
      ]);
      expect(refs2.addressFromUrl.mock.calls).toEqual([
        ["http://foo.bar/miss"],
      ]);
      expect(refs3.addressFromUrl.mock.calls).toEqual([
        ["http://foo.bar/miss"],
      ]);
      expect(n1).toEqual(undefined);
    });

    it("should return the first ReferenceDetector's value that provides a hit", () => {
      // Given
      const refs1 = exampleDetector([["http://foo.bar/1", nodeA]]);
      const refs2 = exampleDetector([
        ["http://foo.bar/1", nodeB],
        ["http://foo.bar/2", nodeB],
      ]);
      const refs3 = exampleDetector([
        ["http://foo.bar/1", nodeC],
        ["http://foo.bar/2", nodeC],
        ["http://foo.bar/3", nodeC],
      ]);

      // When
      const refs = new CascadingReferenceDetector([refs1, refs2, refs3]);
      const n1 = refs.addressFromUrl("http://foo.bar/1");
      const n2 = refs.addressFromUrl("http://foo.bar/2");
      const n3 = refs.addressFromUrl("http://foo.bar/3");

      // Then
      expect(refs1.addressFromUrl.mock.calls).toEqual([
        ["http://foo.bar/1"],
        ["http://foo.bar/2"],
        ["http://foo.bar/3"],
      ]);
      expect(refs2.addressFromUrl.mock.calls).toEqual([
        ["http://foo.bar/2"],
        ["http://foo.bar/3"],
      ]);
      expect(refs3.addressFromUrl.mock.calls).toEqual([["http://foo.bar/3"]]);
      expect(n1).toEqual(nodeA);
      expect(n2).toEqual(nodeB);
      expect(n3).toEqual(nodeC);
    });
  });
});
