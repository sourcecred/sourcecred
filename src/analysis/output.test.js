// @flow

import deepFreeze from "deep-freeze";
import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import {TimelineCred} from "./timeline/timelineCred";
import {defaultParams} from "./timeline/params";
import {nodeWeightEvaluator} from "../core/algorithm/weightEvaluator";
import {fromTimelineCredAndPlugins} from "./output";

describe("src/analysis/output", () => {
  const nodeType = {
    name: "node",
    pluralName: "nodes",
    prefix: NodeAddress.fromParts(["node"]),
    defaultWeight: 2,
    description: "a node",
  };
  const userType = {
    name: "user",
    pluralName: "users",
    prefix: NodeAddress.fromParts(["user"]),
    defaultWeight: 5,
    description: "a user",
  };
  const plugin = deepFreeze({
    name: "a plugin",
    nodePrefix: NodeAddress.empty,
    nodeTypes: [nodeType, userType],
    edgePrefix: EdgeAddress.empty,
    edgeTypes: [],
    userTypes: [userType],
  });

  function example() {
    const aNode = {
      address: NodeAddress.fromParts(["node", "a"]),
      description: "a node",
      timestampMs: 123,
    };
    const bNode = {
      address: NodeAddress.fromParts(["node", "b"]),
      description: "b node",
      timestampMs: 125,
    };
    const userNode = {
      address: NodeAddress.fromParts(["user", "steven"]),
      description: "a steven",
      timestampMs: null,
    };
    const graph = new Graph().addNode(aNode).addNode(bNode).addNode(userNode);
    const edgeWeights = new Map();
    const nodeWeights = new Map()
      .set(NodeAddress.empty, 5)
      .set(bNode.address, 7);
    const weights = {nodeWeights, edgeWeights};
    const weightedGraph = {graph, weights};
    const intervals = [
      {startTimeMs: 0, endTimeMs: 1000},
      {startTimeMs: 1000, endTimeMs: 2000},
    ];
    const addressToCred = new Map()
      .set(aNode.address, [1, 2])
      .set(bNode.address, [2, 4])
      .set(userNode.address, [5, 5]);
    const params = defaultParams();
    const plugins = [plugin];
    const timelineCred = new TimelineCred(
      weightedGraph,
      intervals,
      addressToCred,
      params,
      plugins
    );

    const output = fromTimelineCredAndPlugins(timelineCred, plugins);

    return {aNode, bNode, userNode, intervals, timelineCred, output};
  }

  describe("output via fromTimelineCredAndPlugins", () => {
    it("contains plugins", () => {
      const {output} = example();
      expect(output.plugins).toEqual([plugin]);
    });
    it("nodes have address, timestamp, description, and ordering from the graph", () => {
      const {output, timelineCred} = example();
      const nodes = Array.from(timelineCred.weightedGraph().graph.nodes());
      expect(
        output.orderedNodes.map((n) => ({
          address: NodeAddress.fromParts(n.address),
          description: n.description,
          timestampMs: n.timestamp,
        }))
      ).toEqual(nodes);
    });
    it("nodes' minted cred is computed correctly", () => {
      // The minted cred is equal to the node weight, except in the special
      // case where the timetsamp is null, in which case the minted cred is
      // zero (per semantics of TimelineCred).
      const {output, timelineCred} = example();
      const {weights} = timelineCred.weightedGraph();
      const nodeEvaluator = nodeWeightEvaluator(weights);
      let foundEdgeCase = false;
      for (const {address, minted, timestamp} of output.orderedNodes) {
        const weight = nodeEvaluator(NodeAddress.fromParts(address));
        if (timestamp == null && weight !== 0) {
          foundEdgeCase = true;
          expect(minted).toBe(0);
        } else {
          expect(minted).toBe(weight);
        }
      }
      expect(foundEdgeCase).toBe(true);
    });
    it("nodes' cred is equal to the total cred across time slices", () => {
      const {output, timelineCred} = example();
      for (const {address, cred} of output.orderedNodes) {
        const credNode = timelineCred.credNode(NodeAddress.fromParts(address));
        if (credNode == null) {
          throw new Error("Can't find node");
        }
        expect(cred).toEqual(credNode.total);
      }
    });
    it("by default, all nodes have cred over time", () => {
      const {output, timelineCred} = example();
      for (const {address, credOverTime} of output.orderedNodes) {
        const credNode = timelineCred.credNode(NodeAddress.fromParts(address));
        if (credNode == null) {
          throw new Error("Can't find node");
        }
        expect(credOverTime).toEqual(credNode.cred);
      }
    });
  });
});
