// @flow

export type InstanceConfig = {|
  +bundledPlugins: $ReadOnlyArray<BundledPluginSpec>,
|};

// Plugin identifier, like `sourcecred/identity`. Version number is
// implicit from the SourceCred version. This is a stopgap until we have
// a plugin system that admits external, dynamically loaded
// dependencies.
export type BundledPluginSpec = string;
