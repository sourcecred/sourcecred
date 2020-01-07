// @flow

import {
  EdgeAddress,
  NodeAddress,
  type EdgeAddressT,
  type NodeAddressT,
} from "../../core/graph";
import type {ReferenceDetector, URL} from "../../core/references";
import type {Initiative, InitiativeRepository} from "./initiative";
import {topicAddress} from "../discourse/address";
import {createGraph} from "./createGraph";
import {
  initiativeNodeType,
  dependsOnEdgeType,
  referencesEdgeType,
  contributesToEdgeType,
  championsEdgeType,
} from "./declaration";

class MockInitiativeRepository implements InitiativeRepository {
  _counter: number;
  _initiatives: Initiative[];

  constructor() {
    this._counter = 1;
    this._initiatives = [];
  }

  addInitiative(shape?: $Shape<Initiative>): Initiative {
    const num = this._counter;
    this._counter++;

    const initiative: Initiative = {
      title: `Example Initiative ${num}`,
      timestampMs: 400 + num,
      completed: false,
      tracker: topicAddress("https://example.com", num),
      dependencies: [],
      references: [],
      contributions: [],
      champions: [],
      ...shape,
    };

    this._initiatives.push(initiative);
    return initiative;
  }

  initiatives() {
    return [...this._initiatives];
  }
}

class MockReferenceDetector implements ReferenceDetector {
  _references: Map<URL, NodeAddressT>;

  constructor() {
    this._references = new Map();
    jest.spyOn(this, "addressFromUrl");
  }

  addReference(url: URL, address: NodeAddressT) {
    this._references.set(url, address);
  }

  addressFromUrl(url: URL): ?NodeAddressT {
    return this._references.get(url);
  }
}

function example() {
  return {
    repo: new MockInitiativeRepository(),
    refs: new MockReferenceDetector(),
  };
}

function exampleNodeAddress(id: number): NodeAddressT {
  return NodeAddress.fromParts(["example", String(id)]);
}

function discourseInitiativeAddress(id: number): NodeAddressT {
  return NodeAddress.append(
    initiativeNodeType.prefix,
    ...NodeAddress.toParts(topicAddress("https://example.com", id))
  );
}

function edgeAddress(prefix: EdgeAddressT) {
  return (
    initiativeAddress: NodeAddressT,
    other: NodeAddressT
  ): EdgeAddressT => {
    return EdgeAddress.append(
      prefix,
      ...NodeAddress.toParts(initiativeAddress),
      ...NodeAddress.toParts(other)
    );
  };
}

const dependencyEdgeAddress = edgeAddress(dependsOnEdgeType.prefix);
const referenceEdgeAddress = edgeAddress(referencesEdgeType.prefix);
const contributionEdgeAddress = edgeAddress(contributesToEdgeType.prefix);
const championEdgeAddress = edgeAddress(championsEdgeType.prefix);

describe("plugins/initiatives/createGraph", () => {
  describe("createGraph", () => {
    it("should add initiative nodes to the graph", () => {
      // Given
      const {repo, refs} = example();
      repo.addInitiative();
      repo.addInitiative();

      // When
      const graph = createGraph(repo, refs);

      // Then
      const nodes = Array.from(
        graph.nodes({prefix: initiativeNodeType.prefix})
      );
      expect(nodes).toEqual([
        {
          description: "Example Initiative 1",
          timestampMs: 401,
          address: discourseInitiativeAddress(1),
        },
        {
          description: "Example Initiative 2",
          timestampMs: 402,
          address: discourseInitiativeAddress(2),
        },
      ]);
    });

    it("should add the tracker as a contribution edge", () => {
      // Given
      const {repo, refs} = example();
      const i1 = repo.addInitiative();

      // When
      const graph = createGraph(repo, refs);

      // Then
      const contributions = Array.from(
        graph.edges({
          addressPrefix: contributesToEdgeType.prefix,
          showDangling: true,
        })
      );
      expect(contributions).toEqual([
        {
          address: contributionEdgeAddress(
            discourseInitiativeAddress(1),
            i1.tracker
          ),
          dst: discourseInitiativeAddress(1),
          src: i1.tracker,
          timestampMs: i1.timestampMs,
        },
      ]);
    });

    describe("reference detection attempts", () => {
      it("should attempt to resolve dependency URLs", () => {
        // Given
        const {repo, refs} = example();
        repo.addInitiative({
          dependencies: ["https://example.com/1"],
        });

        // When
        createGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/1"
        );
      });

      it("should attempt to resolve reference URLs", () => {
        // Given
        const {repo, refs} = example();
        repo.addInitiative({
          references: ["https://example.com/2"],
        });

        // When
        createGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/2"
        );
      });

      it("should attempt to resolve contribution URLs", () => {
        // Given
        const {repo, refs} = example();
        repo.addInitiative({
          contributions: ["https://example.com/3"],
        });

        // When
        createGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/3"
        );
      });

      it("should attempt to resolve champion URLs", () => {
        // Given
        const {repo, refs} = example();
        repo.addInitiative({
          champions: ["https://example.com/4"],
        });

        // When
        createGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/4"
        );
      });
    });

    describe("adding detected edges", () => {
      it("should add edges for dependency URLs it can resolve", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          dependencies: ["https://example.com/1", "https://example.com/99"],
        });

        // When
        const graph = createGraph(repo, refs);

        // Then
        const dependencies = Array.from(
          graph.edges({
            addressPrefix: dependsOnEdgeType.prefix,
            showDangling: true,
          })
        );
        expect(refs.addressFromUrl).toHaveBeenCalledTimes(2);
        expect(dependencies).toHaveLength(1);
        expect(dependencies).toContainEqual({
          address: dependencyEdgeAddress(
            discourseInitiativeAddress(1),
            exampleNodeAddress(1)
          ),
          src: discourseInitiativeAddress(1),
          dst: exampleNodeAddress(1),
          timestampMs: 401,
        });
      });

      it("should add edges for reference URLs it can resolve", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/2", exampleNodeAddress(2));
        repo.addInitiative({
          references: ["https://example.com/2", "https://example.com/99"],
        });

        // When
        const graph = createGraph(repo, refs);

        // Then
        const references = Array.from(
          graph.edges({
            addressPrefix: referencesEdgeType.prefix,
            showDangling: true,
          })
        );
        expect(refs.addressFromUrl).toHaveBeenCalledTimes(2);
        expect(references).toHaveLength(1);
        expect(references).toContainEqual({
          address: referenceEdgeAddress(
            discourseInitiativeAddress(1),
            exampleNodeAddress(2)
          ),
          src: discourseInitiativeAddress(1),
          dst: exampleNodeAddress(2),
          timestampMs: 401,
        });
      });

      it("should add edges for contribution URLs it can resolve", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/3", exampleNodeAddress(3));
        repo.addInitiative({
          contributions: ["https://example.com/3", "https://example.com/99"],
        });

        // When
        const graph = createGraph(repo, refs);

        // Then
        const contributions = Array.from(
          graph.edges({
            addressPrefix: contributesToEdgeType.prefix,
            showDangling: true,
          })
        );
        expect(refs.addressFromUrl).toHaveBeenCalledTimes(2);
        expect(contributions).toHaveLength(2);
        expect(contributions).toContainEqual({
          address: contributionEdgeAddress(
            discourseInitiativeAddress(1),
            exampleNodeAddress(3)
          ),
          src: exampleNodeAddress(3),
          dst: discourseInitiativeAddress(1),
          timestampMs: 401,
        });
      });

      it("should add edges for champion URLs it can resolve", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/4", exampleNodeAddress(4));
        repo.addInitiative({
          champions: ["https://example.com/4", "https://example.com/99"],
        });

        // When
        const graph = createGraph(repo, refs);

        // Then
        const champions = Array.from(
          graph.edges({
            addressPrefix: championsEdgeType.prefix,
            showDangling: true,
          })
        );
        expect(refs.addressFromUrl).toHaveBeenCalledTimes(2);
        expect(champions).toHaveLength(1);
        expect(champions).toContainEqual({
          address: championEdgeAddress(
            discourseInitiativeAddress(1),
            exampleNodeAddress(4)
          ),
          src: exampleNodeAddress(4),
          dst: discourseInitiativeAddress(1),
          timestampMs: 401,
        });
      });
    });
  });
});
