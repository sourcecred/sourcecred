// @flow

import sortBy from "lodash.sortby";
import {
  Graph,
  NodeAddress,
  EdgeAddress,
  type NodeAddressT,
  type Edge,
  type EdgesOptions,
} from "./graph";
import {
  PagerankGraph,
  Direction,
  DEFAULT_MAX_ITERATIONS,
  DEFAULT_CONVERGENCE_THRESHOLD,
  DEFAULT_ALPHA,
  DEFAULT_SEED,
} from "./pagerankGraph";
import {advancedGraph, node, partsNode, partsEdge} from "./graphTestUtil";
import * as NullUtil from "../util/null";

describe("core/pagerankGraph", () => {
  const defaultEvaluator = (_unused_edge) => ({toWeight: 1, froWeight: 0});
  const nonEmptyGraph = () => new Graph().addNode(node("hi"));

  function examplePagerankGraph(
    edgeEvaluator = defaultEvaluator
  ): PagerankGraph {
    const g = advancedGraph().graph1();
    return new PagerankGraph(g, edgeEvaluator);
  }
  async function convergedPagerankGraph(): Promise<PagerankGraph> {
    const pg = examplePagerankGraph();
    await pg.runPagerank({maxIterations: 100, convergenceThreshold: 1e-4});
    return pg;
  }

  it("cannot construct PagerankGraph with empty Graph", () => {
    const eg1 = new Graph();
    const eg2 = new Graph().addNode(node("hi")).removeNode(node("hi").address);
    expect(() => new PagerankGraph(eg1, defaultEvaluator)).toThrowError(
      "empty graph"
    );
    expect(() => new PagerankGraph(eg2, defaultEvaluator)).toThrowError(
      "empty graph"
    );
  });

  describe("setEdgeEvaluator", () => {
    it("is idempotent", () => {
      const e1 = examplePagerankGraph(defaultEvaluator);
      const e2 = examplePagerankGraph(defaultEvaluator);
      e2.setEdgeEvaluator(defaultEvaluator);
      expect(e1.equals(e2)).toBe(true);
    });
    it("graphs with changed edge weights are not equal", () => {
      const e1 = examplePagerankGraph();
      const e2 = examplePagerankGraph();
      e2.setEdgeEvaluator(() => ({toWeight: 3, froWeight: 9}));
      expect(e1.equals(e2)).toBe(false);
    });
    it("graphs are distinct but with identical scores if evaluators are the same modulo multiplication", async () => {
      // Think of this test as a bit more of an "e2e sanity check", verifying
      // a few properties at once.
      // We start with two example graphs with edge evaluators that are the same, except the scores
      // are different by a scalar multiple of 3.
      // So we know the scores should all turn out the same, but the graphs will be different,
      // because the edge weights are nominally distinct.
      const e1 = examplePagerankGraph(() => ({toWeight: 3, froWeight: 6}));
      const e2 = examplePagerankGraph(() => ({toWeight: 1, froWeight: 2}));
      expect(e1.equals(e2)).toBe(false);
      await e1.runPagerank();
      await e2.runPagerank();
      for (const {node, score} of e1.nodes()) {
        const otherScore = NullUtil.get(e2.node(node.address)).score;
        expect(otherScore).toBeCloseTo(score);
      }
    });
  });

  describe("node / nodes", () => {
    it("node returns undefined for node not in the graph", () => {
      const g = nonEmptyGraph();
      const pg = new PagerankGraph(g, defaultEvaluator);
      expect(pg.node(NodeAddress.empty)).toBe(undefined);
    });
    it("nodes yields the same nodes as are in the graph", () => {
      const g = advancedGraph().graph1();
      const pg = new PagerankGraph(g, defaultEvaluator);
      const graphNodes = Array.from(g.nodes());
      const pgNodes = Array.from(pg.nodes()).map((x) => x.node);
      expect(graphNodes).toEqual(pgNodes);
    });
    it("node and nodes both return consistent scores", async () => {
      const pg = await convergedPagerankGraph();
      for (const {node, score} of pg.nodes()) {
        expect(score).toEqual(NullUtil.get(pg.node(node.address)).score);
      }
    });
    it("node and nodes both throw an error if underlying graph is modified", () => {
      const pg = new PagerankGraph(nonEmptyGraph(), defaultEvaluator);
      pg.graph().addNode(node("foo"));
      expect(() => pg.nodes()).toThrowError(
        "underlying Graph has been modified"
      );
      expect(() => pg.node(NodeAddress.empty)).toThrowError(
        "underlying Graph has been modified"
      );
    });
  });

  describe("node prefix filter matches graph filter", () => {
    const n1 = partsNode([]);
    const n2 = partsNode(["foo"]);
    const n3 = partsNode(["foo", "bar"]);
    const n4 = partsNode(["zod", "bar"]);
    const g = () =>
      new Graph()
        .addNode(n1)
        .addNode(n2)
        .addNode(n3)
        .addNode(n4);
    const pg = () => new PagerankGraph(g(), defaultEvaluator);

    function expectPagerankGraphToEqualGraph(
      options: {|+prefix: NodeAddressT|} | void
    ) {
      const pagerankGraphNodes = Array.from(pg().nodes(options)).sort();
      const graphNodes = Array.from(g().nodes(options)).sort();

      pagerankGraphNodes.forEach(
        (pgNode, i) =>
          expect(pgNode.node).toEqual(graphNodes[i]) &&
          expect(pgNode.score).toBe(0.25)
      );
    }

    it("with no options object", () => {
      expectPagerankGraphToEqualGraph(undefined);
    });

    it("with prefix filter", () => {
      expectPagerankGraphToEqualGraph({prefix: n2.address});
    });

    it("with empty prefix", () => {
      expectPagerankGraphToEqualGraph({prefix: NodeAddress.empty});
    });

    it("with prefix that matches nothing", () => {
      expectPagerankGraphToEqualGraph({prefix: NodeAddress.fromParts(["2"])});
    });
  });

  describe("node prefix filter", () => {
    it("requires a prefix when options are specified", () => {
      const pg = new PagerankGraph(nonEmptyGraph(), defaultEvaluator);
      // $ExpectFlowError
      expect(() => pg.nodes({})).toThrow("prefix");
    });
  });

  describe("edge/edges", () => {
    it("edges returns the same edges as are in the graph", () => {
      const g = advancedGraph().graph1();
      const pg = new PagerankGraph(g, defaultEvaluator);
      const graphEdges = Array.from(g.edges());
      const pgEdges = Array.from(pg.edges()).map((x) => x.edge);
      expect(graphEdges.length).toEqual(pgEdges.length);
      const addressAccessor = (x: Edge) => x.address;
      const sortedGraphEdges = sortBy(graphEdges, addressAccessor);
      const sortedPagerankEdges = sortBy(pgEdges, addressAccessor);
      expect(sortedGraphEdges).toEqual(sortedPagerankEdges);
    });

    it("edge/edges both correctly return the edge weights", () => {
      const edgeEvaluator = ({address, src, dst}) => {
        return {
          toWeight: address.length + src.length,
          froWeight: address.length + dst.length,
        };
      };
      const g = advancedGraph().graph1();
      const pg = new PagerankGraph(g, edgeEvaluator);
      for (const {edge, weight} of pg.edges()) {
        expect(edgeEvaluator(edge)).toEqual(weight);
        expect(NullUtil.get(pg.edge(edge.address)).weight).toEqual(weight);
      }
    });

    it("edge returns undefined for address not in the graph", () => {
      const pg = new PagerankGraph(nonEmptyGraph(), defaultEvaluator);
      expect(pg.edge(EdgeAddress.empty)).toBe(undefined);
    });

    it("edge and edges both throw an error if underlying graph is modified", () => {
      const pg = new PagerankGraph(nonEmptyGraph(), defaultEvaluator);
      pg.graph().addNode(node("foo"));
      expect(() => pg.edges()).toThrowError(
        "underlying Graph has been modified"
      );
      expect(() => pg.edge(EdgeAddress.empty)).toThrowError(
        "underlying Graph has been modified"
      );
    });
  });

  describe("totalOutWeight", () => {
    it("errors on a modified graph", () => {
      const eg = examplePagerankGraph();
      const badNode = node("badNode");
      eg.graph().addNode(badNode);
      expect(() => eg.totalOutWeight(badNode.address)).toThrowError(
        "has been modified"
      );
    });
    it("errors on nonexistent node", () => {
      const eg = examplePagerankGraph();
      expect(() =>
        eg.totalOutWeight(NodeAddress.fromParts(["nonexistent"]))
      ).toThrowError("non-existent node");
    });
    function verifyOutWeights(pg: PagerankGraph) {
      const outWeight: Map<NodeAddressT, number> = new Map();
      for (const node of pg.graph().nodes()) {
        outWeight.set(node.address, pg.syntheticLoopWeight());
      }
      const addOutWeight = (node: NodeAddressT, weight: number) => {
        const previousWeight = NullUtil.get(outWeight.get(node));
        const newWeight = previousWeight + weight;
        outWeight.set(node, newWeight);
      };
      for (const {edge, weight} of pg.edges()) {
        addOutWeight(edge.src, weight.toWeight);
        addOutWeight(edge.dst, weight.froWeight);
      }
      for (const node of pg.graph().nodes()) {
        expect(pg.totalOutWeight(node.address)).toEqual(
          outWeight.get(node.address)
        );
      }
    }
    it("computes outWeight correctly on the example graph", () => {
      const edgeEvaluator = (_unused_edge) => ({toWeight: 1, froWeight: 2});
      const eg = examplePagerankGraph(edgeEvaluator);
      verifyOutWeights(eg);
    });
    it("outWeight is always the syntheticLoopWeight when edges have no weight", () => {
      const zeroEvaluator = (_unused_edge) => ({toWeight: 0, froWeight: 0});
      const syntheticLoopWeight = 0.1337;
      const pg = new PagerankGraph(
        advancedGraph().graph1(),
        zeroEvaluator,
        syntheticLoopWeight
      );
      for (const {node} of pg.nodes()) {
        expect(pg.totalOutWeight(node.address)).toEqual(syntheticLoopWeight);
      }
    });
    it("outWeight is computed correctly after JSON deserialization", () => {
      // I added this test because the outWeight map is a cache that is computed
      // once, in the constructor, and since the JSON deserialization invokes
      // the constructor and then hacks variables around a bit, I want to ensure the
      // outWeight cache is still generated properly.
      const eg = examplePagerankGraph();
      const eg_ = PagerankGraph.fromJSON(eg.toJSON());
      verifyOutWeights(eg_);
    });
  });

  describe("edge filtering", () => {
    const src1 = partsNode(["src", "1"]);
    const src2 = partsNode(["src", "2"]);
    const dst1 = partsNode(["dst", "1"]);
    const dst2 = partsNode(["dst", "2"]);
    const e11 = partsEdge(["e", "1", "1"], src1, dst1);
    const e12 = partsEdge(["e", "1", "2"], src1, dst2);
    const e21 = partsEdge(["e", "2", "1"], src2, dst1);
    const e22 = partsEdge(["e", "2", "2"], src2, dst2);
    const graph = () => {
      const g = new Graph();
      [src1, src2, dst1, dst2].forEach((n) => g.addNode(n));
      [e11, e12, e21, e22].forEach((e) => g.addEdge(e));
      return g;
    };
    const pagerankGraph = () => new PagerankGraph(graph(), defaultEvaluator);

    function expectConsistentEdges(options: EdgesOptions | void) {
      const pagerankGraphEdges = Array.from(pagerankGraph().edges(options));
      pagerankGraphEdges.forEach((e) => {
        expect(e.weight.froWeight).toBe(0);
        expect(e.weight.toWeight).toBe(1);
      });
      const graphEdges = Array.from(graph().edges(options));
      expect(pagerankGraphEdges.map((e) => e.edge)).toEqual(graphEdges);
    }

    describe("edge filter matches graph edge filter", () => {
      it("finds all edges when no options are specified", () => {
        expectConsistentEdges(undefined);
      });
      it("finds all edges when all-inclusive filters are specified", () => {
        expectConsistentEdges({
          addressPrefix: EdgeAddress.fromParts(["e"]),
          srcPrefix: NodeAddress.fromParts(["src"]),
          dstPrefix: NodeAddress.fromParts(["dst"]),
        });
      });
      it("finds edges by address prefix", () => {
        expectConsistentEdges({
          addressPrefix: EdgeAddress.fromParts(["e", "1"]),
          srcPrefix: NodeAddress.empty,
          dstPrefix: NodeAddress.empty,
        });
      });
      it("finds edges by src prefix", () => {
        expectConsistentEdges({
          addressPrefix: EdgeAddress.empty,
          srcPrefix: NodeAddress.fromParts(["src", "1"]),
          dstPrefix: NodeAddress.empty,
        });
      });
      it("finds edges by dst prefix", () => {
        expectConsistentEdges({
          addressPrefix: EdgeAddress.empty,
          srcPrefix: NodeAddress.empty,
          dstPrefix: NodeAddress.fromParts(["dst", "1"]),
        });
      });
      it("yields nothing for disjoint filters", () => {
        expectConsistentEdges({
          addressPrefix: EdgeAddress.fromParts(["e", "1"]),
          srcPrefix: NodeAddress.fromParts(["src", "2"]),
          dstPrefix: NodeAddress.empty,
        });
      });
      it("yields appropriate filter intersection", () => {
        expectConsistentEdges({
          addressPrefix: EdgeAddress.empty,
          srcPrefix: NodeAddress.fromParts(["src", "1"]),
          dstPrefix: NodeAddress.fromParts(["dst", "2"]),
        });
      });
    });

    describe("edge filter options", () => {
      it("requires `addressPrefix` to be present in provided options", () => {
        expect(() => {
          pagerankGraph()
            // $ExpectFlowError
            .edges({srcPrefix: src1, dstPrefix: dst1});
        }).toThrow("Invalid address prefix: undefined");
      });
      it("requires `srcPrefix` to be present in provided options", () => {
        expect(() => {
          pagerankGraph()
            // $ExpectFlowError
            .edges({addressPrefix: e11, dstPrefix: dst1});
        }).toThrow("Invalid src prefix: undefined");
      });

      it("requires `dstPrefix` to be present in provided options", () => {
        expect(() => {
          pagerankGraph()
            // $ExpectFlowError
            .edges({addressPrefix: e11, srcPrefix: dst1});
        }).toThrow("Invalid dst prefix: undefined");
      });
    });
  });

  describe("neighbors", () => {
    const allNeighbors = () => ({
      direction: Direction.ANY,
      nodePrefix: NodeAddress.empty,
      edgePrefix: EdgeAddress.empty,
    });
    it("is an error to call neighbors after modifying the underlying graph", () => {
      const pg = examplePagerankGraph();
      pg.graph().addNode(partsNode(["foomfazzle"]));
      expect(() =>
        pg.neighbors(NodeAddress.fromParts(["src"]), allNeighbors())
      ).toThrowError("has been modified");
    });
    it("it is an error to call neighbors on a non-existent node", () => {
      const pg = examplePagerankGraph();
      expect(() =>
        pg.neighbors(NodeAddress.fromParts(["foomfazzle"]), allNeighbors())
      ).toThrowError("non-existent node");
    });
    it("neighbors returns results consistent with Graph.neighbors", () => {
      const directions = [Direction.IN, Direction.ANY, Direction.OUT];
      const nodePrefixes = [
        NodeAddress.empty,
        NodeAddress.fromParts(["src"]),
        NodeAddress.fromParts(["nonexistent"]),
      ];
      const edgePrefixes = [
        EdgeAddress.empty,
        EdgeAddress.fromParts(["hom"]),
        EdgeAddress.fromParts(["nonexistent"]),
      ];
      const targets = [
        NodeAddress.fromParts(["src"]),
        NodeAddress.fromParts(["loop"]),
      ];

      const graph = advancedGraph().graph1();
      const pagerankGraph = new PagerankGraph(graph, defaultEvaluator);
      for (const direction of directions) {
        for (const nodePrefix of nodePrefixes) {
          for (const edgePrefix of edgePrefixes) {
            for (const target of targets) {
              const options = {direction, nodePrefix, edgePrefix};
              const prgNeighbors = Array.from(
                pagerankGraph.neighbors(target, options)
              );
              const gNeighbors = Array.from(graph.neighbors(target, options));
              const reducedPrgNeighbors = prgNeighbors.map((s) => ({
                node: s.scoredNode.node,
                edge: s.weightedEdge.edge,
              }));
              expect(gNeighbors).toEqual(reducedPrgNeighbors);
            }
          }
        }
      }
    });
  });

  describe("score decomposition", () => {
    const allNeighbors = () => ({
      direction: Direction.ANY,
      nodePrefix: NodeAddress.empty,
      edgePrefix: EdgeAddress.empty,
    });
    it("neighbor's scored contributions are computed correctly", async () => {
      const pg = await convergedPagerankGraph();
      for (const {node} of pg.nodes()) {
        const target = node.address;
        for (const {
          scoredNode,
          weightedEdge,
          scoreContribution,
        } of pg.neighbors(target, allNeighbors())) {
          let rawWeight = 0;
          if (weightedEdge.edge.dst === target) {
            rawWeight += weightedEdge.weight.toWeight;
          }
          if (weightedEdge.edge.src === target) {
            rawWeight += weightedEdge.weight.froWeight;
          }
          const normalizedWeight =
            rawWeight / pg.totalOutWeight(scoredNode.node.address);
          expect(scoreContribution).toEqual(
            scoredNode.score * normalizedWeight
          );
        }
      }
    });
    it("synthetic score contributions are computed correctly", async () => {
      const pg = await convergedPagerankGraph();
      for (const {node, score} of pg.nodes()) {
        const {address} = node;
        expect(pg.syntheticLoopScoreContribution(address)).toEqual(
          (score * pg.syntheticLoopWeight()) / pg.totalOutWeight(address)
        );
      }
    });
    it("neighbors score contributions + synthetic score contribution == node score", async () => {
      // Note: I've verified that test fails if we don't properly handle loop
      // neighbors (need to add the edge toWeight and froWeight if the neighbor
      // is a loop).
      const pg = await convergedPagerankGraph();
      for (const {node, score} of pg.nodes()) {
        // We need to include the score that came from the synthetic loop edge
        // (should be near zero for non-isolated nodes)
        let summedScoreContributions: number = pg.syntheticLoopScoreContribution(
          node.address
        );
        for (const scoredNeighbor of pg.neighbors(
          node.address,
          allNeighbors()
        )) {
          summedScoreContributions += scoredNeighbor.scoreContribution;
        }
        expect(summedScoreContributions).toBeCloseTo(score);
      }
    });
  });

  describe("runPagerank", () => {
    // The mathematical semantics of PageRank are thoroughly tested
    // in the markovChain module. The goal for these tests is just
    // to make sure that the API calls are glued together properly,
    // so it's mostly option + sanity checking

    function checkUniformDistribution(pg: PagerankGraph) {
      const nodes = Array.from(pg.nodes());
      for (const {score} of nodes) {
        expect(score).toEqual(1 / nodes.length);
      }
    }

    function checkProbabilityDistribution(pg: PagerankGraph) {
      let total = 0;
      for (const {score} of pg.nodes()) {
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(1);
        total += score;
      }
      expect(total).toBeCloseTo(1);
    }

    it("runs PageRank with default options if not specified", () => {
      const pg1 = examplePagerankGraph();
      const pg2 = examplePagerankGraph();
      const pg3 = examplePagerankGraph();
      pg1.runPagerank();
      pg2.runPagerank({});
      pg3.runPagerank({
        maxIterations: DEFAULT_MAX_ITERATIONS,
        convergenceThreshold: DEFAULT_CONVERGENCE_THRESHOLD,
        alpha: DEFAULT_ALPHA,
        seed: DEFAULT_SEED(),
      });
      expect(pg1.equals(pg2)).toBe(true);
      expect(pg1.equals(pg3)).toBe(true);
    });

    describe("alpha and seed parameters", () => {
      // The logic for seeded PageRank (and for generating the seed distribution via weights)
      // are both thoroughly unit-tested. Therefore, these tests only sanity check that the
      // parameters are getting consumed properly based on easily tested properties.
      it("seed is irrelevant if alpha is 0", async () => {
        const pg1 = examplePagerankGraph();
        const pg2 = examplePagerankGraph();
        const {nodes} = advancedGraph();
        const seed1 = new Map().set(nodes.src.address, 1);
        const seed2 = new Map().set(nodes.dst.address, 1);
        await pg1.runPagerank({seed: seed1, alpha: 0});
        await pg2.runPagerank({seed: seed2, alpha: 0});
        expect(pg1.equals(pg2)).toBe(true);
      });

      it("seed is returned directly if alpha is 1", async () => {
        const pg = examplePagerankGraph();
        const src = advancedGraph().nodes.src;
        const seed = new Map().set(src.address, 1);
        await pg.runPagerank({seed, alpha: 1});
        const score = NullUtil.get(pg.node(src.address)).score;
        expect(score).toBe(1);
      });
    });

    it("promise rejects if the graph was modified", async () => {
      const pg = examplePagerankGraph();
      pg.graph().addNode(node("foo"));
      expect(
        pg.runPagerank({maxIterations: 1, convergenceThreshold: 1})
      ).rejects.toThrow("underlying Graph has been modified");
      // It's possible that you could avoid the rejection if you
      // make the modification after calling runPagerank (but before
      // promise resolves). However, since every getter also checks
      // for modification, this is not a serious issue.
    });
    it("scores are a uniform distribution prior to running PageRank", () => {
      checkUniformDistribution(examplePagerankGraph());
    });
    it("respects maxIterations==0", async () => {
      const pg = examplePagerankGraph();
      const results = await pg.runPagerank({
        maxIterations: 0,
        convergenceThreshold: 0,
      });
      expect(results.convergenceDelta).toBeGreaterThan(0);
      checkUniformDistribution(pg);
    });
    it("will limit at max iterations when convergence threshld is low", async () => {
      const pg = examplePagerankGraph();
      const convergenceThreshold = 1e-18;
      const results = await pg.runPagerank({
        maxIterations: 17,
        convergenceThreshold,
      });
      expect(results.convergenceDelta).toBeGreaterThan(convergenceThreshold);
      checkProbabilityDistribution(pg);
    });
    it("will converge when threshold is high", async () => {
      const pg = examplePagerankGraph();
      const convergenceThreshold = 0.01;
      const results = await pg.runPagerank({
        maxIterations: 170,
        convergenceThreshold,
      });
      expect(results.convergenceDelta).toBeLessThan(convergenceThreshold);
      checkProbabilityDistribution(pg);
    });
    it("re-uses existing scores as a starting point", async () => {
      const pg = examplePagerankGraph();
      const convergenceThreshold = 0.001;
      const results1 = await pg.runPagerank({
        maxIterations: 170,
        convergenceThreshold,
      });
      expect(results1.convergenceDelta).toBeLessThan(convergenceThreshold);
      // It should still converge without any iterations, because it uses the
      // final distribution as a starting point
      const results2 = await pg.runPagerank({
        maxIterations: 0,
        convergenceThreshold,
      });
      expect(results2.convergenceDelta).toEqual(results1.convergenceDelta);
    });
  });

  describe("equals", () => {
    it("PagerankGraph is equal to itself", () => {
      const pg = examplePagerankGraph();
      expect(pg.equals(pg)).toBe(true);
    });
    it("two identicalPagerankGraphs are equal", () => {
      const pg1 = examplePagerankGraph();
      const pg2 = examplePagerankGraph();
      expect(pg1.equals(pg2)).toBe(true);
    });
    it("unequal syntheticLoopWeight => unequal", () => {
      const pg1 = new PagerankGraph(nonEmptyGraph(), defaultEvaluator, 0.1);
      const pg2 = new PagerankGraph(nonEmptyGraph(), defaultEvaluator, 0.2);
      expect(pg1.equals(pg2)).toBe(false);
    });
    it("unequal graph => unequal", () => {
      const pg1 = new PagerankGraph(nonEmptyGraph(), defaultEvaluator, 0.1);
      const g2 = nonEmptyGraph().addNode(node("foo"));
      const pg2 = new PagerankGraph(g2, defaultEvaluator, 0.1);
      expect(pg1.equals(pg2)).toBe(false);
    });
    it("unequal scores => unequal", async () => {
      const pg1 = examplePagerankGraph();
      const pg2 = examplePagerankGraph();
      await pg1.runPagerank({maxIterations: 2, convergenceThreshold: 0.001});
      expect(pg1.equals(pg2)).toBe(false);
    });
    it("unequal edge weights => unequal", () => {
      const evaluator1 = (_unused_edge) => ({toWeight: 1, froWeight: 1});
      const evaluator2 = (_unused_edge) => ({toWeight: 0, froWeight: 1});
      const pg1 = new PagerankGraph(advancedGraph().graph1(), evaluator1);
      const pg2 = new PagerankGraph(advancedGraph().graph1(), evaluator2);
      expect(pg1.equals(pg2)).toBe(false);
    });
    it("different modification history => still equal", () => {
      // advancedGraph.graph1 and graph2 are identical except for their
      // construction history
      const pg1 = new PagerankGraph(advancedGraph().graph1(), defaultEvaluator);
      const pg2 = new PagerankGraph(advancedGraph().graph2(), defaultEvaluator);
      expect(pg1.equals(pg2)).toBe(true);
    });
    it("throws an error if comparing PagerankGraph to non-PagerankGraph", () => {
      const pg = examplePagerankGraph();
      const g = new Graph();
      // $ExpectFlowError
      expect(() => pg.equals(g)).toThrowError("Expected PagerankGraph");
    });
    it("throws an error if the underlying graph is modified", () => {
      const pg = examplePagerankGraph();
      pg.graph().addNode(node("modification"));
      expect(() => pg.equals(pg)).toThrowError("has been modified");
    });
  });

  describe("to/from JSON", () => {
    it("to->fro is identity", async () => {
      const pg = await convergedPagerankGraph();
      const pgJSON = pg.toJSON();
      const pg_ = PagerankGraph.fromJSON(pgJSON);
      expect(pg.equals(pg_)).toBe(true);
    });
    it("fro->to is identity", async () => {
      const pg = await convergedPagerankGraph();
      const pgJSON = pg.toJSON();
      const pg_ = PagerankGraph.fromJSON(pgJSON);
      const pgJSON_ = pg_.toJSON();
      expect(pgJSON).toEqual(pgJSON_);
    });
    it("is canonical with respect to the graph's history", async () => {
      const pg1 = new PagerankGraph(advancedGraph().graph1(), defaultEvaluator);
      const pg2 = new PagerankGraph(advancedGraph().graph2(), defaultEvaluator);
      const pg1JSON = pg1.toJSON();
      const pg2JSON = pg2.toJSON();
      expect(pg1JSON).toEqual(pg2JSON);
    });
    it("matches expected snapshot", () => {
      const pgJSON = examplePagerankGraph().toJSON();
      expect(pgJSON).toMatchSnapshot();
    });
  });
});
