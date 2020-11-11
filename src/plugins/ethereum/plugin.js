// @flow

import type {Plugin, PluginDirectoryContext} from "../../api/plugin";
import type {PluginDeclaration} from "../../analysis/pluginDeclaration";
import {
  MappedReferenceDetector,
  type ReferenceDetector,
} from "../../core/references";
import {declaration} from "./declaration";
import {parser as ethJsonParser} from "./ethAddress";
import {
  type PluginId,
  fromString as pluginIdFromString,
} from "../../api/pluginId";
import {loadJson} from "../../util/disk";
import {join as pathJoin} from "path";
import {
  empty as emptyWeightedGraph,
  type WeightedGraph,
} from "../../core/weightedGraph";
import {createIdentities} from "./createIdentities";
import type {IdentityProposal} from "../../core/ledger/identityProposal";

async function loadEthJson(ctx: PluginDirectoryContext) {
  const path = pathJoin(ctx.configDirectory(), "ethereumAddresses.json");
  return await loadJson(path, ethJsonParser);
}

export class EthereumPlugin implements Plugin {
  id: PluginId = pluginIdFromString("sourcecred/ethereum");

  declaration(): PluginDeclaration {
    return declaration;
  }

  // We dont need to load any data since eth addresses are on disk
  async load(): Promise<void> {}

  // TODO: Implement weighted graph generation logic
  async graph(
    _unused_ctx: PluginDirectoryContext,
    _unused_rd: ReferenceDetector
  ): Promise<WeightedGraph> {
    return emptyWeightedGraph();
  }

  // TODO: Implement referenceDetector generation logic
  async referenceDetector(
    _unused_ctx: PluginDirectoryContext
  ): Promise<ReferenceDetector> {
    const emptyReferenceDetector = new MappedReferenceDetector(new Map());
    return emptyReferenceDetector;
  }

  async identities(
    ctx: PluginDirectoryContext
  ): Promise<$ReadOnlyArray<IdentityProposal>> {
    const ethAddressJson = await loadEthJson(ctx);
    return createIdentities(ethAddressJson);
  }
}
