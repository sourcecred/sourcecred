// @flow

import {
  defaultWeightedNodeType,
  defaultWeightedEdgeType,
  defaultWeightsForDeclaration,
  combineWeights,
} from "./weights";
import {
  inserterNodeType,
  machineNodeType,
  assemblesEdgeType,
  transportsEdgeType,
  declaration,
} from "../plugins/demo/declaration";

describe("analysis/weights", () => {
  describe("defaultWeightedNodeType", () => {
    it("sets default weight as specified in type", () => {
      const wnt = defaultWeightedNodeType(inserterNodeType);
      expect(wnt.weight).toEqual(wnt.type.defaultWeight);
    });
  });
  describe("defaultWeightedEdgeType", () => {
    it("sets default weights as specified in the type", () => {
      const wet = defaultWeightedEdgeType(assemblesEdgeType);
      expect(wet.weight.forwards).toEqual(wet.type.defaultWeight.forwards);
      expect(wet.weight.backwards).toEqual(wet.type.defaultWeight.backwards);
    });
  });
  describe("defaultWeightsForDeclaration", () => {
    it("works on the demo declaration", () => {
      const expected = {
        nodes: new Map(
          declaration.nodeTypes.map((x) => [
            x.prefix,
            defaultWeightedNodeType(x),
          ])
        ),
        edges: new Map(
          declaration.edgeTypes.map((x) => [
            x.prefix,
            defaultWeightedEdgeType(x),
          ])
        ),
      };
      expect(defaultWeightsForDeclaration(declaration)).toEqual(expected);
    });
  });
  describe("combineWeights", () => {
    const defaultWeights = () => defaultWeightsForDeclaration(declaration);
    const emptyWeights = () => ({nodes: new Map(), edges: new Map()});
    it("successfully combines WeightedTypes", () => {
      const weights1 = {
        nodes: new Map().set(
          inserterNodeType.prefix,
          defaultWeightedNodeType(inserterNodeType)
        ),
        edges: new Map().set(
          assemblesEdgeType.prefix,
          defaultWeightedEdgeType(assemblesEdgeType)
        ),
      };
      const weights2 = {
        nodes: new Map().set(
          machineNodeType.prefix,
          defaultWeightedNodeType(machineNodeType)
        ),
        edges: new Map().set(
          transportsEdgeType.prefix,
          defaultWeightedEdgeType(transportsEdgeType)
        ),
      };
      expect(combineWeights([weights1, weights2])).toEqual(defaultWeights());
    });
    it("treats empty weights as an identity", () => {
      expect(
        combineWeights([emptyWeights(), defaultWeights(), emptyWeights()])
      ).toEqual(defaultWeights());
    });
    it("errors on duplicate edge prefix", () => {
      const weights = {
        nodes: new Map(),
        edges: new Map().set(
          assemblesEdgeType.prefix,
          defaultWeightedEdgeType(assemblesEdgeType)
        ),
      };
      expect(() => combineWeights([weights, weights])).toThrowError(
        "duplicate key"
      );
    });
    it("errors on duplicate node prefix", () => {
      const weights = {
        nodes: new Map().set(
          inserterNodeType.prefix,
          defaultWeightedNodeType(inserterNodeType)
        ),
        edges: new Map(),
      };
      expect(() => combineWeights([weights, weights])).toThrowError(
        "duplicate key"
      );
    });
  });
});
