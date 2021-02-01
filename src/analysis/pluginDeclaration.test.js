// @flow

import stringify from "json-stable-stringify";
import deepFreeze from "deep-freeze";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {type NodeType, type EdgeType} from "./types";
import {
  weightsForDeclaration,
  type PluginDeclaration,
  toJSON,
  fromJSON,
} from "./pluginDeclaration";
import * as WeightsT from "../core/weights/weightsT";

describe("analysis/pluginDeclaration", () => {
  const nodeType: NodeType = deepFreeze({
    name: "node",
    pluralName: "nodes",
    prefix: NodeAddress.fromParts(["node"]),
    defaultWeight: 2,
    description: "a type",
  });
  const edgeType: EdgeType = deepFreeze({
    forwardName: "points",
    backwardName: "is pointed to",
    prefix: EdgeAddress.fromParts(["edge"]),
    defaultWeight: {forwards: 2, backwards: 3},
    description: "a type",
  });
  const emptyDeclaration: PluginDeclaration = deepFreeze({
    name: "empty",
    nodePrefix: NodeAddress.empty,
    edgePrefix: EdgeAddress.empty,
    nodeTypes: [],
    edgeTypes: [],
    userTypes: [],
  });
  const nonEmptyDeclaration: PluginDeclaration = deepFreeze({
    name: "non-empty",
    nodePrefix: NodeAddress.empty,
    edgePrefix: EdgeAddress.empty,
    nodeTypes: [nodeType],
    edgeTypes: [edgeType],
    userTypes: [],
  });
  describe("weightsForDeclaration", () => {
    it("works for an empty declaration", () => {
      expect(weightsForDeclaration(emptyDeclaration)).toEqual(WeightsT.empty());
    });
    it("works for a non-empty declaration", () => {
      const expected = WeightsT.empty();
      expected.nodeWeightsT.set(nodeType.prefix, nodeType.defaultWeight);
      expected.edgeWeightsT.set(edgeType.prefix, edgeType.defaultWeight);
      const actual = weightsForDeclaration(nonEmptyDeclaration);
      expect(expected).toEqual(actual);
    });
  });

  describe("to/fromJSON", () => {
    it("works round-trip on an empty declaration", () => {
      const json = toJSON([emptyDeclaration]);
      const result = fromJSON(json);
      expect(result).toEqual([emptyDeclaration]);
    });
    it("snapshots on an empty declaration", () => {
      // stringify to avoid having literal NUL bytes in our source.
      expect(stringify(toJSON([emptyDeclaration]))).toMatchSnapshot();
    });
    it("works round-trip on an non-empty declaration", () => {
      const json = toJSON([nonEmptyDeclaration]);
      const result = fromJSON(json);
      expect(result).toEqual([nonEmptyDeclaration]);
    });
    it("snapshots on an non-empty declaration", () => {
      // stringify to avoid having literal NUL bytes in our source.
      expect(stringify(toJSON([nonEmptyDeclaration]))).toMatchSnapshot();
    });
  });
});
