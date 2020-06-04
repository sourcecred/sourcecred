// @flow

import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import type {NodeType, EdgeType} from "./types";
import {
  type PluginDeclaration,
  weightsForDeclaration,
} from "./pluginDeclaration";
import {defaultParams} from "./timeline/params";
import {compute} from "./credResult";
import {CredView} from "./credView";

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
    const result = await compute(wg, params, [declaration]);
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
});
