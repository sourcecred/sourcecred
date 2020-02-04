// @flow

import {type PluginDeclaration} from "../../analysis/pluginDeclaration";
import {declaration} from "./declaration";

export interface Loader {
  declaration(): PluginDeclaration;
}

export default ({
  declaration: () => declaration,
}: Loader);
