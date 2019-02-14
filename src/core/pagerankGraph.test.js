// @flow

import sortBy from "lodash.sortby";
import {Graph, NodeAddress, EdgeAddress, type Edge} from "./graph";
import {PagerankGraph} from "./pagerankGraph";
import {advancedGraph} from "./graphTestUtil";
import * as NullUtil from "../util/null";

describe("core/pagerankGraph", () => {
  const defaultEvaluator = (_unused_edge) => ({toWeight: 1, froWeight: 0});
  const nonEmptyGraph = () =>
    new Graph().addNode(NodeAddress.fromParts(["hi"]));

  it("cannot construct PagerankGraph with empty Graph", () => {
    const eg1 = new Graph();
    const eg2 = new Graph()
      .addNode(NodeAddress.empty)
      .removeNode(NodeAddress.empty);
    expect(() => new PagerankGraph(eg1, defaultEvaluator)).toThrowError(
      "empty graph"
    );
    expect(() => new PagerankGraph(eg2, defaultEvaluator)).toThrowError(
      "empty graph"
    );
  });

  describe("node / nodes", () => {
    it("node returns null for node not in the graph", () => {
      const g = nonEmptyGraph();
      const pg = new PagerankGraph(g, defaultEvaluator);
      expect(pg.node(NodeAddress.empty)).toEqual(null);
    });
    it("nodes yields the same nodes as are in the graph", () => {
      const g = advancedGraph().graph1();
      const pg = new PagerankGraph(g, defaultEvaluator);
      const graphNodes = Array.from(g.nodes());
      const pgNodes = Array.from(pg.nodes()).map((x) => x.node);
      expect(graphNodes.length).toEqual(pgNodes.length);
      expect(new Set(graphNodes)).toEqual(new Set(pgNodes));
    });
    it("node and nodes both return consistent scores", async () => {
      const g = advancedGraph().graph1();
      const pg = new PagerankGraph(g, defaultEvaluator);
      await pg.runPagerank({maxIterations: 1, convergenceThreshold: 0.001});
      for (const {node, score} of pg.nodes()) {
        expect(score).toEqual(NullUtil.get(pg.node(node)).score);
      }
    });
    it("node and nodes both throw an error if underlying graph is modified", () => {
      const pg = new PagerankGraph(nonEmptyGraph(), defaultEvaluator);
      pg.graph().addNode(NodeAddress.empty);
      expect(() => pg.nodes()).toThrowError(
        "underlying Graph has been modified"
      );
      expect(() => pg.node(NodeAddress.empty)).toThrowError(
        "underlying Graph has been modified"
      );
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

    it("edge returns null for address not in the graph", () => {
      const pg = new PagerankGraph(nonEmptyGraph(), defaultEvaluator);
      expect(pg.edge(EdgeAddress.empty)).toEqual(null);
    });

    it("edge and edges both throw an error if underlying graph is modified", () => {
      const pg = new PagerankGraph(nonEmptyGraph(), defaultEvaluator);
      pg.graph().addNode(NodeAddress.empty);
      expect(() => pg.edges()).toThrowError(
        "underlying Graph has been modified"
      );
      expect(() => pg.edge(EdgeAddress.empty)).toThrowError(
        "underlying Graph has been modified"
      );
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

    function examplePagerankGraph() {
      const g = advancedGraph().graph1();
      return new PagerankGraph(g, defaultEvaluator);
    }

    it("promise rejects if the graph was modified", async () => {
      const pg = examplePagerankGraph();
      pg.graph().addNode(NodeAddress.empty);
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
  });
});
