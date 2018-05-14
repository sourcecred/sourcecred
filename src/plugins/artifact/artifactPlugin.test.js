// @flow

import {Graph} from "@/core/graph";
import {artifactAddress} from "./artifactPlugin";

describe("artifactPlugin", () => {
  describe("artifactAddress", () => {
    it("repositoryName included in id", () => {
      const a = artifactAddress(
        new Graph(),
        "not-sourcecred",
        "not-artifact-plugin",
        "Sample artifact!"
      );
      expect(a.id.startsWith("not-sourcecred/not-artifact-plugin")).toBe(true);
    });

    it("slugifies the artifact name", () => {
      const a = artifactAddress(
        new Graph(),
        "not-sourcecred",
        "not-artifact-plugin",
        "Sample artifact!"
      );
      expect(a.id).toEqual(
        "not-sourcecred/not-artifact-plugin/sample-artifact-"
      );
    });

    it("resolves collisions", () => {
      const g = new Graph();
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const a = artifactAddress(
          g,
          "not-sourcecred",
          "not-artifact-plugin",
          "Sample artifact!"
        );
        ids.push(a.id);
        g.addNode({
          address: a,
          payload: {name: "Sample artifact!", description: ""},
        });
      }
      expect(ids).toEqual([
        "not-sourcecred/not-artifact-plugin/sample-artifact-",
        "not-sourcecred/not-artifact-plugin/sample-artifact--0",
        "not-sourcecred/not-artifact-plugin/sample-artifact--1",
      ]);
    });
  });
});
