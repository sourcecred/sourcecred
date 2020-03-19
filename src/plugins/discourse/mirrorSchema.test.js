// @flow

import type {Creates, Upgrades} from "./mirrorSchema";
import {SCHEMA_VERSION, createVersion, upgrades} from "./mirrorSchema";

// Assumes a v1 style suffix.
const versionRE = new RegExp(/v(\d+)$/i);
function extractVersionNumber(version: string): number {
  const match = versionRE.exec(version);
  if (!match) {
    throw new Error(`Version didn't match expected pattern: ${version}`);
  }
  return Number(match[1]);
}

function expectHigherTargetVersions(upgrades: Upgrades) {
  for (const currentKey in upgrades) {
    const {target: targetKey} = upgrades[currentKey];
    const current = extractVersionNumber(currentKey);
    const target = extractVersionNumber(targetKey);
    if (current >= target) {
      throw new Error(
        `Upgrade from ${currentKey} does not upgrade to a newer version (${targetKey})`
      );
    }
  }
}

function expectUpgradePathToLatest(latest: string, upgrades: Upgrades) {
  // Tracks the versions with upgrade paths so far. Starting with just latest.
  const resolved = new Set([latest]);
  const pending = new Set(Object.keys(upgrades));

  while (pending.size) {
    // Find all upgrade sources which can be resolved in 1 step.
    const resolvable = Array.from(pending).filter((source) =>
      resolved.has(upgrades[source].target)
    );

    // If there's isn't any path forward in this pass, we're violating the invariant.
    if (resolvable.length === 0) {
      throw new Error(
        `Can't find a path for upgrades [${Array.from(pending).join(", ")}]`
      );
    }

    // Grow the set of resolved targets with the ones in this pass.
    for (const k of resolvable) {
      resolved.add(k);
      pending.delete(k);
    }
  }
}

function expectUpgradePathToLatestFromCreate(
  latest: string,
  creates: Creates,
  upgrades: Upgrades
) {
  // Knowing that each upgrade resolves to latest, we can add these to the resolved keys.
  expectUpgradePathToLatest(latest, upgrades);

  // All upgrade sources and latest will resolve to latest.
  const resolved = new Set([latest, ...Object.keys(upgrades)]);

  // We already resolved the upgrades, so all creates must resolve in 1 step.
  // "meta" is an exception to this.
  const unresolved = Object.keys(creates)
    .filter((k) => k !== "meta")
    .filter((k) => !resolved.has(k));

  // If there's isn't any path forward in this pass, we're violating the invariant.
  if (unresolved.length > 0) {
    throw new Error(
      `Can't find a path for creates [${Array.from(unresolved).join(", ")}]`
    );
  }
}

describe("plugins/discourse/mirrorSchema", () => {
  describe("createVersion", () => {
    it("invariant: should always have a 'meta' version", () => {
      if (!createVersion.meta) {
        throw new Error("createVersion is missing a meta key");
      }
    });

    it("invariant: should always have a path to the latest version", () => {
      expectUpgradePathToLatestFromCreate(
        SCHEMA_VERSION,
        createVersion,
        upgrades
      );
    });
  });

  describe("upgrades", () => {
    it("invariant: should always upgrade to a higher version", () => {
      expectHigherTargetVersions(upgrades);
    });
    it("invariant: should always have a path to the latest version", () => {
      expectUpgradePathToLatest(SCHEMA_VERSION, upgrades);
    });
  });

  describe("test helper functions", () => {
    const blankCreate = () => [];

    describe("expectUpgradePathToLatestFromCreate", () => {
      it("should pass for a good example", () => {
        expectUpgradePathToLatestFromCreate(
          "v2",
          {
            v1: blankCreate,
            v2: blankCreate,
          },
          {
            v1: {target: "v2", changes: []},
          }
        );
      });
    });

    describe("expectUpgradePathToLatest", () => {
      it("should pass for a good example", () => {
        expectUpgradePathToLatest("v5", {
          v1: {target: "v2", changes: []},
          v2: {target: "v4", changes: []}, // Skips v3
          v3: {target: "v4", changes: []},
          v4: {target: "v5", changes: []},
        });
      });

      it("should throw when upgrades don't go up to the current version", () => {
        expect(() =>
          expectUpgradePathToLatest("v3", {
            v1: {target: "v2", changes: []},
          })
        ).toThrow("Can't find a path for upgrades [v1]");
      });

      it("should throw when there's a dangling upgrade", () => {
        expect(() =>
          expectUpgradePathToLatest("v4", {
            v1: {target: "v2", changes: []},
            // Missing v2 upgrade path.
            v3: {target: "v4", changes: []},
          })
        ).toThrow("Can't find a path for upgrades [v1]");
      });

      it("should throw when there are multiple upgrades not resolvable", () => {
        expect(() =>
          expectUpgradePathToLatest("v6", {
            v1: {target: "v2", changes: []},
            v2: {target: "v3", changes: []},
            v5: {target: "v6", changes: []},
          })
        ).toThrow("Can't find a path for upgrades [v1, v2]");
      });

      it("should throw when upgrading beyond the current version", () => {
        expect(() =>
          expectUpgradePathToLatest("v3", {
            v2: {target: "v4", changes: []},
          })
        ).toThrow("Can't find a path for upgrades [v2]");
      });
    });

    describe("expectHigherTargetVersions", () => {
      it("should pass for a good example", () => {
        expectHigherTargetVersions({
          v1: {target: "v2", changes: []},
          v9: {target: "v10", changes: []},
        });
      });

      it("should throw when downgrading", () => {
        expect(() =>
          expectHigherTargetVersions({
            v10: {target: "v2", changes: []},
          })
        ).toThrow("Upgrade from v10 does not upgrade to a newer version (v2)");
      });

      it("should throw when staying on the same version", () => {
        expect(() =>
          expectHigherTargetVersions({
            v10: {target: "v10", changes: []},
          })
        ).toThrow("Upgrade from v10 does not upgrade to a newer version (v10)");
      });
    });
  });
});
