// @flow
import * as pluginId from "./pluginId";
import * as P from "../util/combo";

export type RawInstanceConfig = {|
  // Plugin identifier, like `sourcecred/identity`. Version number is
  // implicit from the SourceCred version. This is a stopgap until we have
  // a plugin system that admits external, dynamically loaded
  // dependencies.
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
|};

export const rawParser: P.Parser<RawInstanceConfig> = P.object({
  bundledPlugins: P.array(pluginId.parser),
});
