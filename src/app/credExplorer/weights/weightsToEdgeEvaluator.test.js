// @flow

import * as NullUtil from "../../../util/null";
import {
  fallbackNodeType,
  fallbackEdgeType,
} from "../../adapters/fallbackAdapter";
import {
  inserterNodeType,
  machineNodeType,
  assemblesEdgeType,
  factorioEdges,
} from "../../adapters/demoAdapters";
import {weightsToEdgeEvaluator} from "./weightsToEdgeEvaluator";

describe("app/credExplorer/weights/weightsToEdgeEvaluator", () => {
  describe("weightsToEdgeEvaluator", () => {
    type WeightArgs = {|
      +assemblesForward?: number,
      +assemblesBackward?: number,
      +baseForward?: number,
      +baseBackward?: number,
      +inserter?: number,
      +machine?: number,
      +baseNode?: number,
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
      return {nodes, edges};
    }
    function exampleEdgeWeights(weightArgs: WeightArgs) {
      const ws = weights(weightArgs);
      const ee = weightsToEdgeEvaluator(ws);
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
  });
});
