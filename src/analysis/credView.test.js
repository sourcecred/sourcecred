// @flow

import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import {get as nullGet} from "../util/null";
import type {NodeType, EdgeType} from "./types";
import {
  type PluginDeclaration,
  weightsForDeclaration,
} from "./pluginDeclaration";
import {defaultParams} from "./timeline/params";
import {compute} from "./credResult";
import {CredView, _getIntervalIndex} from "./credView";
import {intervalSequence} from "../core/interval";

describe("analysis/credView", () => {
  async function example() {
    const weekMs = 604800000;
    const fooType: NodeType = {
      name: "foo",
      pluralName: "foos",
      prefix: NodeAddress.fromParts(["foo"]),
      defaultWeight: 2,
      description: "foo type",
    };
    const userType: NodeType = {
      name: "user",
      pluralName: "users",
      prefix: NodeAddress.fromParts(["user"]),
      defaultWeight: 0,
      description: "user type",
    };
    const flowType: EdgeType = {
      forwardName: "flows to",
      backwardName: "is flowed to by",
      prefix: EdgeAddress.fromParts(["flow"]),
      defaultWeight: {forwards: 2, backwards: 3},
      description: "flow type",
    };
    const streamType: EdgeType = {
      forwardName: "streams to",
      backwardName: "is stramed to by",
      prefix: EdgeAddress.fromParts(["stream"]),
      defaultWeight: {forwards: 1, backwards: 0},
      description: "stream type",
    };
    const declaration: PluginDeclaration = {
      name: "plugin",
      nodePrefix: NodeAddress.empty,
      edgePrefix: EdgeAddress.empty,
      nodeTypes: [fooType, userType],
      edgeTypes: [flowType, streamType],
      userTypes: [userType],
    };
    const foo1 = {
      address: NodeAddress.fromParts(["foo", "1"]),
      timestampMs: 0,
      description: "foo1",
    };
    const foo2 = {
      address: NodeAddress.fromParts(["foo", "2"]),
      timestampMs: weekMs,
      description: "foo2",
    };
    const user = {
      address: NodeAddress.fromParts(["user"]),
      timestampMs: null,
      description: "a user",
    };
    const flow1 = {
      address: EdgeAddress.fromParts(["flow", "1"]),
      src: foo1.address,
      dst: user.address,
      timestampMs: 0,
    };
    const flow2 = {
      address: EdgeAddress.fromParts(["flow", "2"]),
      src: foo1.address,
      dst: user.address,
      timestampMs: weekMs,
    };
    const stream1 = {
      address: EdgeAddress.fromParts(["stream", "1"]),
      src: user.address,
      dst: foo2.address,
      timestampMs: weekMs,
    };
    const dangling = {
      address: EdgeAddress.fromParts(["dangling"]),
      src: foo1.address,
      dst: NodeAddress.fromParts(["non-existent"]),
      timestampMs: weekMs,
    };

    const graph = new Graph()
      .addNode(foo1)
      .addNode(foo2)
      .addNode(user)
      .addEdge(flow1)
      .addEdge(flow2)
      .addEdge(stream1)
      .addEdge(dangling);
    const weights = weightsForDeclaration(declaration);
    const wg = {graph, weights};
    const params = defaultParams();
    const result = await compute(wg, params, [declaration], []);
    const credView = new CredView(result);
    return {
      credView,
      foo1,
      foo2,
      user,
      flow1,
      flow2,
      stream1,
      credResult: result,
      dangling,
      fooType,
      flowType,
      userType,
      streamType,
      graph,
      weights,
      declaration,
      params,
    };
  }

  describe("basic accessors", () => {
    it("can retrieve the graph", async () => {
      const {credView, graph} = await example();
      expect(credView.graph()).toBe(graph);
    });
    it("can retrieve the weights", async () => {
      const {credView, weights} = await example();
      expect(credView.weights()).toBe(weights);
    });
    it("can retrieve the params", async () => {
      const {credView, params} = await example();
      expect(credView.params()).toEqual(params);
    });
    it("can retrieve the plugin declarations", async () => {
      const {credView, declaration} = await example();
      expect(credView.plugins()).toEqual([declaration]);
    });
  });

  describe("nodes", () => {
    it("can retrieve a CredNode", async () => {
      const {credView, foo1, graph, credResult} = await example();
      const {
        address,
        credOverTime,
        credSummary,
        description,
        minted,
        timestamp,
        intervalIndex,
      } = nullGet(credView.node(foo1.address));
      expect({address, description, timestampMs: timestamp}).toEqual(foo1);
      expect(minted).toEqual(2);
      const nodeOrder = Array.from(graph.nodes()).map((x) => x.address);
      const index = nodeOrder.findIndex((x) => x === foo1.address);
      expect(credOverTime).toEqual(credResult.credData.nodeOverTime[index]);
      expect(credSummary).toEqual(credResult.credData.nodeSummaries[index]);
      expect(intervalIndex).toEqual(
        _getIntervalIndex(credView.intervals(), nullGet(timestamp))
      );
    });
    it("returns undefined for non-existent node", async () => {
      const {credView} = await example();
      expect(credView.node(NodeAddress.fromParts(["nope"]))).toBe(undefined);
    });
    it("returns array of all nodes when no arguments provided", async () => {
      const {credView, foo1, foo2, user} = await example();
      expect(credView.nodes()).toEqual(
        [foo1, foo2, user].map((x) => credView.node(x.address))
      );
    });
    it("nodes can filter by prefix", async () => {
      const {credView, foo1, foo2, fooType} = await example();
      expect(credView.nodes({prefix: fooType.prefix})).toEqual(
        [foo1, foo2].map((x) => credView.node(x.address))
      );
    });
  });

  describe("edges", () => {
    it("can retrieve a CredEdge", async () => {
      const {credView, flow1, credResult, graph} = await example();
      const {
        address,
        src,
        dst,
        credOverTime,
        credSummary,
        rawWeight,
        timestamp,
        intervalIndex,
      } = nullGet(credView.edge(flow1.address));
      expect({
        address,
        src: src.address,
        dst: dst.address,
        timestampMs: timestamp,
      }).toEqual(flow1);
      const edgeOrder = Array.from(graph.edges({showDangling: false})).map(
        (x) => x.address
      );
      const index = edgeOrder.findIndex((x) => x === flow1.address);
      expect(src).toEqual(credView.node(src.address));
      expect(dst).toEqual(credView.node(dst.address));
      expect(rawWeight).toEqual({forwards: 2, backwards: 3});
      expect(credOverTime).toEqual(credResult.credData.edgeOverTime[index]);
      expect(credSummary).toEqual(credResult.credData.edgeSummaries[index]);
      expect(intervalIndex).toEqual(
        _getIntervalIndex(credView.intervals(), timestamp)
      );
    });
    it("returns undefined for non-existent edge", async () => {
      const {credView} = await example();
      expect(credView.edge(EdgeAddress.fromParts(["nope"]))).toBe(undefined);
    });
    it("returns undefined for a dangling edge", async () => {
      const {credView, dangling} = await example();
      expect(credView.edge(dangling.address)).toBe(undefined);
    });
    it("returns array of all non-dangling edges when no arguments provided", async () => {
      const {credView, flow1, flow2, stream1} = await example();
      expect(credView.edges()).toEqual(
        [flow1, flow2, stream1].map((x) => credView.edge(x.address))
      );
    });
    it("edges can filter by address prefix", async () => {
      const {credView, flow1, flow2, flowType} = await example();
      expect(credView.edges({addressPrefix: flowType.prefix})).toEqual(
        [flow1, flow2].map((x) => credView.edge(x.address))
      );
    });
    it("edges can filter by src prefix", async () => {
      const {credView, stream1, userType} = await example();
      expect(credView.edges({srcPrefix: userType.prefix})).toEqual([
        credView.edge(stream1.address),
      ]);
    });
    it("edges can filter by dst prefix", async () => {
      const {credView, flow1, flow2, userType} = await example();
      expect(credView.edges({dstPrefix: userType.prefix})).toEqual([
        credView.edge(flow1.address),
        credView.edge(flow2.address),
      ]);
    });
  });

  describe("_getIntervalIndex", () => {
    it("works for the zero-th index", () => {
      const intervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      expect(_getIntervalIndex(intervals, 0)).toEqual(0);
      expect(_getIntervalIndex(intervals, 100)).toEqual(0);
    });
    it("works for a middle index", () => {
      const intervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      expect(_getIntervalIndex(intervals, 101)).toEqual(1);
      expect(_getIntervalIndex(intervals, 200)).toEqual(1);
    });
    it("works for the last index", () => {
      const intervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      expect(_getIntervalIndex(intervals, 299)).toEqual(2);
      expect(_getIntervalIndex(intervals, 300)).toEqual(2);
    });
    it("errors for an index out of bound", () => {
      const intervals = intervalSequence([
        {startTimeMs: 0, endTimeMs: 100},
        {startTimeMs: 100, endTimeMs: 200},
        {startTimeMs: 200, endTimeMs: 300},
      ]);
      const thunk = () => _getIntervalIndex(intervals, 301);
      expect(thunk).toThrowError("timestamp out of interval range");
    });
  });
});
