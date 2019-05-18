// @flow

import * as NullUtil from "../util/null";
import {fallbackNodeType, fallbackEdgeType} from "./fallbackDeclaration";
import {
  inserterNodeType,
  machineNodeType,
  assemblesEdgeType,
} from "../plugins/demo/declaration";
import {
  edges as factorioEdges,
  nodes as factorioNodes,
} from "../plugins/demo/graph";
import type {ManualWeights} from "./weights";
import {weightsToEdgeEvaluator} from "./weightsToEdgeEvaluator";

describe("analysis/weightsToEdgeEvaluator", () => {
  describe("weightsToEdgeEvaluator", () => {
    type WeightArgs = {|
      +assemblesForward?: number,
      +assemblesBackward?: number,
      +baseForward?: number,
      +baseBackward?: number,
      +inserter?: number,
      +machine?: number,
      +baseNode?: number,
      +manualWeights?: ManualWeights,
    |};
    function weights({
      assemblesForward,
      assemblesBackward,
      baseForward,
      baseBackward,
      inserter,
      machine,
      baseNode,
    }: WeightArgs) {
      const nodes = [
        {weight: NullUtil.orElse(inserter, 1), type: inserterNodeType},
        {weight: NullUtil.orElse(machine, 1), type: machineNodeType},
        {weight: NullUtil.orElse(baseNode, 1), type: fallbackNodeType},
      ];
      const nodesMap = new Map(nodes.map((x) => [x.type.prefix, x]));
      const edges = [
        {
          forwardWeight: NullUtil.orElse(assemblesForward, 1),
          backwardWeight: NullUtil.orElse(assemblesBackward, 1),
          type: assemblesEdgeType,
        },
        {
          forwardWeight: NullUtil.orElse(baseForward, 1),
          backwardWeight: NullUtil.orElse(baseBackward, 1),
          type: fallbackEdgeType,
        },
      ];
      const edgesMap = new Map(edges.map((x) => [x.type.prefix, x]));
      return {nodes: nodesMap, edges: edgesMap};
    }
    function exampleEdgeWeights(weightArgs: WeightArgs) {
      const ws = weights(weightArgs);
      const manualWeights = weightArgs.manualWeights || new Map();
      const ee = weightsToEdgeEvaluator(ws, manualWeights);
      // src is a machine, dst is an inserter, edge type is assembles
      return ee(factorioEdges.assembles1);
    }
    it("toWeight is affected by the edge's forwardWeight", () => {
      expect(exampleEdgeWeights({assemblesForward: 2}).toWeight).toEqual(2);
    });
    it("froWeight is affected by the edge's backwardWeight", () => {
      expect(exampleEdgeWeights({assemblesBackward: 3}).froWeight).toEqual(3);
    });
    it("toWeight is affected by the dst's weight", () => {
      expect(exampleEdgeWeights({inserter: 4}).toWeight).toEqual(4);
    });
    it("froWeight is affected by the src's weight", () => {
      expect(exampleEdgeWeights({machine: 5}).froWeight).toEqual(5);
    });
    it("only the closest-matching node prefix is considered", () => {
      expect(exampleEdgeWeights({baseNode: 6})).toEqual({
        toWeight: 1,
        froWeight: 1,
      });
    });
    it("only the closest-matching edge prefix is considered", () => {
      expect(exampleEdgeWeights({baseBackward: 7})).toEqual({
        toWeight: 1,
        froWeight: 1,
      });
    });
    it("node and edge weights compose via multiplication", () => {
      expect(
        exampleEdgeWeights({
          inserter: 2,
          machine: 3,
          assemblesForward: 4,
          assemblesBackward: 5,
        })
      ).toEqual({toWeight: 8, froWeight: 15});
    });
    it("manualWeight and nodeTypeWeight both multiply the weight", () => {
      const manualWeights = new Map();
      manualWeights.set(factorioNodes.inserter2, 2);
      // Putting a weight of 2 on the inserter node type as a whole or on the the
      // particular insterter node will have the same effect
      expect(exampleEdgeWeights({inserter: 2})).toEqual(
        exampleEdgeWeights({manualWeights})
      );
    });
    it("manualWeight and nodeTypeWeight compose multiplicatively", () => {
      const manualWeights = new Map();
      manualWeights.set(factorioNodes.inserter2, 2);
      expect(exampleEdgeWeights({inserter: 3, manualWeights})).toEqual({
        toWeight: 6,
        froWeight: 1,
      });
    });
  });
});
