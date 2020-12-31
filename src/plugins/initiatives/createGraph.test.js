// @flow

import {
  type EdgeAddressT,
  type NodeAddressT,
  EdgeAddress,
  NodeAddress,
} from "../../core/graph";
import * as WeightsT from "../../core/weights/weightsT";
import sortBy from "../../util/sortBy";
import type {ReferenceDetector, URL} from "../../core/references";
import {createWeightedGraph, initiativeWeight} from "./createGraph";
import {type NodeEntry, addressForNodeEntry, _titleSlug} from "./nodeEntry";
import {
  type Initiative,
  type InitiativeRepository,
  createId,
  addressFromId,
} from "./initiative";
import {
  initiativeNodeType,
  dependsOnEdgeType,
  referencesEdgeType,
  contributesToEdgeType,
  championsEdgeType,
  contributesToEntryEdgeType,
} from "./declaration";

const exampleEntry = (overrides: $Shape<NodeEntry>): NodeEntry => ({
  key: overrides.title ? _titleSlug(overrides.title) : "sample-title",
  title: "Sample title",
  timestampMs: 123,
  contributors: [],
  weight: 456,
  ...overrides,
});

function _createInitiative(overrides?: $Shape<Initiative>): Initiative {
  return {
    id: createId("UNSET_SUBTYPE", "42"),
    title: "Unset test initiative",
    timestampMs: 123,
    completed: false,
    contributions: {urls: [], entries: []},
    dependencies: {urls: [], entries: []},
    references: {urls: [], entries: []},
    champions: [],
    ...overrides,
  };
}

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

    const initiative = _createInitiative({
      id: createId("TEST_SUBTYPE", String(num)),
      title: `Example Initiative ${num}`,
      timestampMs: 400 + num,
      ...shape,
    });

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

// Helper function which casts {+address: NodeAddressT | EdgeAddressT} to
// string and sorts by it. Used to prevent test flakes.
function sortByAddress(arr: $ReadOnlyArray<{+address: string}>) {
  return sortBy(arr, ({address}) => address);
}

const dependencyEdgeAddress = edgeAddress(dependsOnEdgeType.prefix);
const referenceEdgeAddress = edgeAddress(referencesEdgeType.prefix);
const contributionEdgeAddress = edgeAddress(contributesToEdgeType.prefix);
const championEdgeAddress = edgeAddress(championsEdgeType.prefix);
const contributesToEntryEdgeAddress = edgeAddress(
  contributesToEntryEdgeType.prefix
);

describe("plugins/initiatives/createGraph", () => {
  describe("initiativeWeight", () => {
    it("should be falsy when the initiative has no weight set", () => {
      // Given
      const initiative = _createInitiative({
        id: createId("TEST_INITIATIVE_WEIGHTS", "41"),
        title: "No weight set",
      });

      // When
      const maybeWeight = initiativeWeight(initiative);

      // Then
      expect(maybeWeight).toBeFalsy();
    });

    it("should use the first weight when not completed", () => {
      // Given
      const initiative = _createInitiative({
        id: createId("TEST_INITIATIVE_WEIGHTS", "41"),
        title: "Weights set, not completed",
        completed: false,
        weight: {incomplete: 222, complete: 333},
      });

      // When
      const maybeWeight = initiativeWeight(initiative);

      // Then
      expect(maybeWeight).toEqual(222);
    });

    it("should use the second weight when completed", () => {
      // Given
      const initiative = _createInitiative({
        id: createId("TEST_INITIATIVE_WEIGHTS", "41"),
        title: "Weights set, completed",
        completed: true,
        weight: {incomplete: 222, complete: 333},
      });

      // When
      const maybeWeight = initiativeWeight(initiative);

      // Then
      expect(maybeWeight).toEqual(333);
    });
  });

  describe("createWeightedGraph", () => {
    it("should add initiative nodes to the graph", () => {
      // Given
      const {repo, refs} = example();
      repo.addInitiative();
      repo.addInitiative();

      // When
      const {graph, weights} = createWeightedGraph(repo, refs);

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
      expect(weights).toEqual(WeightsT.empty());
    });

    it("should add node weights for initiatives with weights", () => {
      // Given
      const {repo, refs} = example();
      repo.addInitiative({weight: {incomplete: 360, complete: 420}});
      repo.addInitiative({weight: {incomplete: 42, complete: 69}});
      repo.addInitiative({
        weight: {incomplete: 42, complete: 69},
        completed: true,
      });

      // When
      const {weights} = createWeightedGraph(repo, refs);

      // Then
      expect(weights.edgeWeightsT.size).toEqual(0);
      expect([...weights.nodeWeightsT.values()]).toEqual([360, 42, 69]);
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
      const {graph} = createWeightedGraph(repo, refs);

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
          dependencies: {
            urls: ["https://example.com/1"],
            entries: [],
          },
        });

        // When
        createWeightedGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/1"
        );
      });

      it("should attempt to resolve reference URLs", () => {
        // Given
        const {repo, refs} = example();
        repo.addInitiative({
          references: {
            urls: ["https://example.com/2"],
            entries: [],
          },
        });

        // When
        createWeightedGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/2"
        );
      });

      it("should attempt to resolve contribution URLs", () => {
        // Given
        const {repo, refs} = example();
        repo.addInitiative({
          contributions: {
            urls: ["https://example.com/3"],
            entries: [],
          },
        });

        // When
        createWeightedGraph(repo, refs);

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
        createWeightedGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/4"
        );
      });

      it("should attempt to resolve entry contributors URLs", () => {
        // Given
        const {repo, refs} = example();
        repo.addInitiative({
          dependencies: {
            urls: [],
            entries: [
              exampleEntry({contributors: ["https://example.com/1/a"]}),
            ],
          },
          references: {
            urls: [],
            entries: [
              exampleEntry({contributors: ["https://example.com/2/a"]}),
            ],
          },
          contributions: {
            urls: [],
            entries: [
              exampleEntry({contributors: ["https://example.com/3/a"]}),
            ],
          },
        });

        // When
        createWeightedGraph(repo, refs);

        // Then
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/1/a"
        );
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/2/a"
        );
        expect(refs.addressFromUrl).toHaveBeenCalledWith(
          "https://example.com/3/a"
        );
      });
    });

    describe("adding detected edges", () => {
      it("should add edges for dependency URLs it can resolve", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          dependencies: {
            urls: ["https://example.com/1", "https://example.com/99"],
            entries: [],
          },
        });

        // When
        const {graph} = createWeightedGraph(repo, refs);

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
          references: {
            urls: ["https://example.com/2", "https://example.com/99"],
            entries: [],
          },
        });

        // When
        const {graph} = createWeightedGraph(repo, refs);

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
          contributions: {
            urls: ["https://example.com/3", "https://example.com/99"],
            entries: [],
          },
        });

        // When
        const {graph} = createWeightedGraph(repo, refs);

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
        const {graph} = createWeightedGraph(repo, refs);

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

    describe("handling node entries", () => {
      it("should add nodes and edges for dependency entries", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          dependencies: {
            urls: [],
            entries: [
              exampleEntry({
                title: "Inline dependency",
                contributors: ["https://example.com/1"],
              }),
            ],
          },
        });

        // When
        const {graph} = createWeightedGraph(repo, refs);

        // Then
        const entryAddress = addressForNodeEntry(
          "DEPENDENCY",
          createId("TEST_SUBTYPE", "1"),
          "inline-dependency"
        );

        const nodes = Array.from(graph.nodes({prefix: entryAddress}));
        const edges = [
          ...graph.edges({dstPrefix: entryAddress, showDangling: true}),
          ...graph.edges({srcPrefix: entryAddress, showDangling: true}),
        ];

        expect(nodes).toEqual([
          {
            address: entryAddress,
            description: "Inline dependency",
            timestampMs: 123,
          },
        ]);
        expect(sortByAddress(edges)).toEqual(
          sortByAddress([
            {
              address: contributesToEntryEdgeAddress(
                entryAddress,
                exampleNodeAddress(1)
              ),
              dst: entryAddress,
              src: exampleNodeAddress(1),
              timestampMs: 123,
            },
            {
              address: dependencyEdgeAddress(
                testInitiativeAddress(1),
                entryAddress
              ),
              dst: entryAddress,
              src: testInitiativeAddress(1),
              timestampMs: 401,
            },
          ])
        );
      });

      it("should add nodes and edges for reference entries", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          references: {
            urls: [],
            entries: [
              exampleEntry({
                title: "Inline reference",
                contributors: ["https://example.com/1"],
              }),
            ],
          },
        });

        // When
        const {graph} = createWeightedGraph(repo, refs);

        // Then
        const entryAddress = addressForNodeEntry(
          "REFERENCE",
          createId("TEST_SUBTYPE", "1"),
          "inline-reference"
        );

        const nodes = Array.from(graph.nodes({prefix: entryAddress}));
        const edges = [
          ...graph.edges({dstPrefix: entryAddress, showDangling: true}),
          ...graph.edges({srcPrefix: entryAddress, showDangling: true}),
        ];

        expect(nodes).toEqual([
          {
            address: entryAddress,
            description: "Inline reference",
            timestampMs: 123,
          },
        ]);
        expect(sortByAddress(edges)).toEqual(
          sortByAddress([
            {
              address: contributesToEntryEdgeAddress(
                entryAddress,
                exampleNodeAddress(1)
              ),
              dst: entryAddress,
              src: exampleNodeAddress(1),
              timestampMs: 123,
            },
            {
              address: referenceEdgeAddress(
                testInitiativeAddress(1),
                entryAddress
              ),
              dst: entryAddress,
              src: testInitiativeAddress(1),
              timestampMs: 401,
            },
          ])
        );
      });

      it("should add nodes and edges for contribution entries", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          contributions: {
            urls: [],
            entries: [
              exampleEntry({
                title: "Inline contribution",
                contributors: ["https://example.com/1"],
              }),
            ],
          },
        });

        // When
        const {graph} = createWeightedGraph(repo, refs);

        // Then
        const entryAddress = addressForNodeEntry(
          "CONTRIBUTION",
          createId("TEST_SUBTYPE", "1"),
          "inline-contribution"
        );

        const nodes = Array.from(graph.nodes({prefix: entryAddress}));
        const edges = [
          ...graph.edges({dstPrefix: entryAddress, showDangling: true}),
          ...graph.edges({srcPrefix: entryAddress, showDangling: true}),
        ];

        expect(nodes).toEqual([
          {
            address: entryAddress,
            description: "Inline contribution",
            timestampMs: 123,
          },
        ]);
        expect(sortByAddress(edges)).toEqual(
          sortByAddress([
            {
              address: contributesToEntryEdgeAddress(
                entryAddress,
                exampleNodeAddress(1)
              ),
              dst: entryAddress,
              src: exampleNodeAddress(1),
              timestampMs: 123,
            },
            {
              address: contributionEdgeAddress(
                testInitiativeAddress(1),
                entryAddress
              ),
              dst: testInitiativeAddress(1),
              src: entryAddress,
              timestampMs: 401,
            },
          ])
        );
      });

      it("should add node weights for dependency entries", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          dependencies: {
            urls: [],
            entries: [
              exampleEntry({title: "Without weight", weight: null}),
              exampleEntry({title: "With weight", weight: 360}),
            ],
          },
        });

        // When
        const {weights} = createWeightedGraph(repo, refs);

        // Then
        const withoutAddress = addressForNodeEntry(
          "DEPENDENCY",
          createId("TEST_SUBTYPE", "1"),
          "without-weight"
        );
        const withAddress = addressForNodeEntry(
          "DEPENDENCY",
          createId("TEST_SUBTYPE", "1"),
          "with-weight"
        );

        const actual = {
          [(withoutAddress: string)]: weights.nodeWeightsT.get(withoutAddress),
          [(withAddress: string)]: weights.nodeWeightsT.get(withAddress),
        };
        expect(actual).toEqual({
          [(withoutAddress: string)]: undefined,
          [(withAddress: string)]: 360,
        });
      });

      it("should add node weights for reference entries", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          references: {
            urls: [],
            entries: [
              exampleEntry({title: "Without weight", weight: null}),
              exampleEntry({title: "With weight", weight: 360}),
            ],
          },
        });

        // When
        const {weights} = createWeightedGraph(repo, refs);

        // Then
        const withoutAddress = addressForNodeEntry(
          "REFERENCE",
          createId("TEST_SUBTYPE", "1"),
          "without-weight"
        );
        const withAddress = addressForNodeEntry(
          "REFERENCE",
          createId("TEST_SUBTYPE", "1"),
          "with-weight"
        );

        const actual = {
          [(withoutAddress: string)]: weights.nodeWeightsT.get(withoutAddress),
          [(withAddress: string)]: weights.nodeWeightsT.get(withAddress),
        };
        expect(actual).toEqual({
          [(withoutAddress: string)]: undefined,
          [(withAddress: string)]: 360,
        });
      });

      it("should add node weights for contribution entries", () => {
        // Given
        const {repo, refs} = example();
        refs.addReference("https://example.com/1", exampleNodeAddress(1));
        repo.addInitiative({
          contributions: {
            urls: [],
            entries: [
              exampleEntry({title: "Without weight", weight: null}),
              exampleEntry({title: "With weight", weight: 360}),
            ],
          },
        });

        // When
        const {weights} = createWeightedGraph(repo, refs);

        // Then
        const withoutAddress = addressForNodeEntry(
          "CONTRIBUTION",
          createId("TEST_SUBTYPE", "1"),
          "without-weight"
        );
        const withAddress = addressForNodeEntry(
          "CONTRIBUTION",
          createId("TEST_SUBTYPE", "1"),
          "with-weight"
        );

        const actual = {
          [(withoutAddress: string)]: weights.nodeWeightsT.get(withoutAddress),
          [(withAddress: string)]: weights.nodeWeightsT.get(withAddress),
        };
        expect(actual).toEqual({
          [(withoutAddress: string)]: undefined,
          [(withAddress: string)]: 360,
        });
      });
    });
  });
});
