// @flow

import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {type WeightedGraph} from "../../core/weightedGraph";
import {type IdentitySpec} from "./identity";
import {contractIdentities} from "./contractIdentities";
import {declaration} from "./declaration";

export interface Loader {
  declaration(): PluginDeclaration;
  contractIdentities(
    weightedGraph: WeightedGraph,
    identitySpec: IdentitySpec
  ): WeightedGraph;
}

export default ({
  declaration: () => declaration,
  contractIdentities,
}: Loader);
