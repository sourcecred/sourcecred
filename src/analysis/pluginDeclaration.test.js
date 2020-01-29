// @flow

import deepFreeze from "deep-freeze";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {type NodeType, type EdgeType} from "./types";
import {
  weightsForDeclaration,
  type PluginDeclaration,
} from "./pluginDeclaration";
import * as Weights from "../core/weights";

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
      expect(weightsForDeclaration(emptyDeclaration)).toEqual(Weights.empty());
    });
    it("works for a non-empty declaration", () => {
      const expected = Weights.empty();
      expected.nodeWeights.set(nodeType.prefix, nodeType.defaultWeight);
      expected.edgeWeights.set(edgeType.prefix, edgeType.defaultWeight);
      const actual = weightsForDeclaration(nonEmptyDeclaration);
      expect(expected).toEqual(actual);
    });
  });
});
