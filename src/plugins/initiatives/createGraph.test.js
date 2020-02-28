// @flow

import {
  EdgeAddress,
  NodeAddress,
  type EdgeAddressT,
  type NodeAddressT,
} from "../../core/graph";
import type {ReferenceDetector, URL} from "../../core/references";
import type {Initiative, InitiativeRepository} from "./initiative";
import {createId, addressFromId} from "./initiative";
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
      id: createId("TEST_SUBTYPE", String(num)),
      title: `Example Initiative ${num}`,
      timestampMs: 400 + num,
      completed: false,
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

function testInitiativeAddress(num: number): NodeAddressT {
  return NodeAddress.append(
    initiativeNodeType.prefix,
    "TEST_SUBTYPE",
    String(num)
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
          address: testInitiativeAddress(1),
        },
        {
          description: "Example Initiative 2",
          timestampMs: 402,
          address: testInitiativeAddress(2),
        },
      ]);
    });

    it("should add initiative file urls to the description", () => {
      // Given
      const {repo, refs} = example();
      const remoteUrl = "http://foo.bar/dir";
      const fileName = "sample.json";
      const id = createId("INITIATIVE_FILE", remoteUrl, fileName);
      const addres = addressFromId(id);
      repo.addInitiative({id});

      // When
      const graph = createGraph(repo, refs);

      // Then
      const node = graph.node(addres);
      expect(node).toMatchObject({
        description: `[Example Initiative 1](${remoteUrl}/${fileName})`,
      });
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
            testInitiativeAddress(1),
            exampleNodeAddress(1)
          ),
          src: testInitiativeAddress(1),
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
            testInitiativeAddress(1),
            exampleNodeAddress(2)
          ),
          src: testInitiativeAddress(1),
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
        expect(contributions).toHaveLength(1);
        expect(contributions).toContainEqual({
          address: contributionEdgeAddress(
            testInitiativeAddress(1),
            exampleNodeAddress(3)
          ),
          src: exampleNodeAddress(3),
          dst: testInitiativeAddress(1),
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
            testInitiativeAddress(1),
            exampleNodeAddress(4)
          ),
          src: exampleNodeAddress(4),
          dst: testInitiativeAddress(1),
          timestampMs: 401,
        });
      });
    });
  });
});
