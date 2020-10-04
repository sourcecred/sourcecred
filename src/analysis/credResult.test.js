// @flow

import stringify from "json-stable-stringify";
import {Graph, NodeAddress, EdgeAddress} from "../core/graph";
import * as Weights from "../core/weights";
import type {NodeType, EdgeType} from "./types";
import type {PluginDeclaration} from "./pluginDeclaration";
import {defaultParams} from "./timeline/params";
import {compute, toJSON, fromJSON} from "./credResult";
import {IDENTITY_PREFIX} from "../core/identity";

describe("analysis/credResult", () => {
  describe("to/fro JSON", () => {
    async function example() {
      const nodeType: NodeType = {
        name: "node",
        pluralName: "nodes",
        prefix: IDENTITY_PREFIX,
        defaultWeight: 2,
        description: "a type",
      };
      const edgeType: EdgeType = {
        forwardName: "points",
        backwardName: "is pointed to",
        prefix: EdgeAddress.fromParts(["edge"]),
        defaultWeight: {forwards: 2, backwards: 3},
        description: "a type",
      };
      const declaration: PluginDeclaration = {
        name: "empty",
        nodePrefix: NodeAddress.empty,
        edgePrefix: EdgeAddress.empty,
        nodeTypes: [nodeType],
        edgeTypes: [edgeType],
        userTypes: [nodeType],
      };

      const graph = new Graph()
        .addNode({
          address: NodeAddress.append(IDENTITY_PREFIX, "1"),
          description: "n1",
          timestampMs: 100000,
        })
        .addNode({
          address: NodeAddress.append(IDENTITY_PREFIX, "2"),
          description: "n2",
          timestampMs: 110000,
        });
      const weights = Weights.empty();
      const wg = {graph, weights};
      const params = defaultParams();
      const result = await compute(wg, params, [declaration], []);
      return result;
    }

    describe("to/froJSON", () => {
      it("round-trips appropriately", async () => {
        const r = await example();
        const j = toJSON(r);
        const r_ = fromJSON(j);
        const j_ = toJSON(r_);

        expect(r.weightedGraph.graph.equals(r_.weightedGraph.graph)).toBe(true);
        expect(r.weightedGraph.weights).toEqual(r_.weightedGraph.weights);
        expect(r.credData).toEqual(r_.credData);
        expect(r.params).toEqual(r_.params);
        expect(r.plugins).toEqual(r_.plugins);
        expect(j).toEqual(j_);
      });
      it("snapshots as expected", async () => {
        const r = await example();
        const j = toJSON(r);
        expect(stringify(j, {space: 2})).toMatchSnapshot();
      });
    });
  });
});
