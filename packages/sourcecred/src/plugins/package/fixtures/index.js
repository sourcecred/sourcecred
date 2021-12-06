// @flow

import {Plugin} from "../../../api/plugin";
import type {PluginDeclaration} from "../../../analysis/pluginDeclaration";
import {
  MappedReferenceDetector,
  type ReferenceDetector,
} from "../../../core/references";
import {coerce, nameFromString} from "../../../core/identity/name";
import {declaration, nodePrefix} from "./declaration";
import {type NodeAddressT, NodeAddress} from "../../../core/graph";
import {type IdentityProposal} from "../../../core/ledger/identityProposal";
import {
  empty as emptyWeightedGraph,
  type WeightedGraph,
} from "../../../core/weightedGraph";

type CustomAddress = string;

function nodeAddressForCustomAddress(address: CustomAddress): NodeAddressT {
  return NodeAddress.append(nodePrefix, address);
}

function createIdentity(address: CustomAddress): IdentityProposal {
  const alias = {
    description: address,
    address: nodeAddressForCustomAddress(address),
  };

  return {
    pluginName: nameFromString("test_custom_identity"),
    name: coerce(address),
    type: "USER",
    alias,
  };
}

export default class MyTestIdentityPlugin implements Plugin {
  async declaration(): Promise<PluginDeclaration> {
    return declaration;
  }

  async load(): Promise<void> {
    return;
  }

  async referenceDetector(): Promise<ReferenceDetector> {
    const emptyReferenceDetector = new MappedReferenceDetector(new Map());
    return emptyReferenceDetector;
  }

  async identities(): Promise<$ReadOnlyArray<IdentityProposal>> {
    return [createIdentity("aBBaddAMyMockIdentityAddress")];
  }

  async graph(): Promise<WeightedGraph> {
    return emptyWeightedGraph();
  }
}
