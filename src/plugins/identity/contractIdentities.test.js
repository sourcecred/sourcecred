// @flow

import {node} from "../../core/graphTestUtil";
import {Graph, NodeAddress} from "../../core/graph";
import * as Weights from "../../core/weights";
import {contractWeightedGraph} from "./contractIdentities";

describe("plugins/identity/contractIdentities", () => {
  const a = node("a");
  const b = node("b");
  const c = node("c");
  const graph = () => new Graph().addNode(a).addNode(b);
  const contractions = () => [{old: [a.address, b.address], replacement: c}];
  const weights = () => {
    const w = Weights.empty();
    w.nodeWeights.set(NodeAddress.empty, 3);
    return w;
  };
  describe("contractWeightedGraph", () => {
    it("contracts the graph", () => {
      const wg = {graph: graph(), weights: weights()};
      const contracted = contractWeightedGraph(wg, contractions());
      const expected = graph().contractNodes(contractions());
      expect(expected.equals(contracted.graph)).toBe(true);
    });
    it("returns a copy of the weights", () => {
      const ws = weights();
      const wg = {graph: graph(), weights: ws};
      const contracted = contractWeightedGraph(wg, contractions());
      expect(contracted.weights).not.toBe(ws);
      expect(ws).toEqual(contracted.weights);
      // check they can be modified independently
      ws.nodeWeights.set(a.address, 5);
      expect(ws).not.toEqual(contracted.weights);
    });
    it("throws an error if a contracted node has an explicit weight", () => {
      const ws = weights();
      ws.nodeWeights.set(a.address, 5);
      const wg = {graph: graph(), weights: ws};
      expect(() => contractWeightedGraph(wg, contractions())).toThrow(
        "Explicit weight 5 on contracted node"
      );
    });
  });
});
