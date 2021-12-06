// @flow

import deepFreeze from "deep-freeze";
import type {PluginDeclaration} from "../../../analysis/pluginDeclaration";
import type {NodeType} from "../../../analysis/types";
import {
  NodeAddress,
  EdgeAddress,
  type NodeAddressT,
  type EdgeAddressT,
} from "../../../core/graph";

export const nodePrefix: NodeAddressT = NodeAddress.fromParts([
  "package_example",
  "test_package",
]);

export const edgePrefix: EdgeAddressT = EdgeAddress.fromParts([
  "package_example",
  "test_package",
]);

export const testPackageAddressEntryType: NodeType = deepFreeze({
  name: `Test Package Address Entry`,
  pluralName: `Test Package Address Entries`,
  prefix: nodePrefix,
  defaultWeight: 0,
  description:
    `A Test Package Address, that can be utilized by a participant` +
    `to receive grain payouts, and linked to their identity.`,
});

export const declaration: PluginDeclaration = deepFreeze({
  name: "test_custom_identity",
  nodePrefix,
  edgePrefix,
  nodeTypes: [testPackageAddressEntryType],
  edgeTypes: [],
  userTypes: [testPackageAddressEntryType],
});
