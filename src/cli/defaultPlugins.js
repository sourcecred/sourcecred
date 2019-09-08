// @flow

import deepFreeze from "deep-freeze";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {declaration as githubDeclaration} from "../plugins/github/declaration";

export const DEFAULT_PLUGINS: $ReadOnlyArray<PluginDeclaration> = deepFreeze([
  githubDeclaration,
]);
