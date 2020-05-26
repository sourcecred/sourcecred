// @flow

// Context for loading a particular plugin.
//
// Passed to both the populate-cache step and the generate-graph step.
export interface PluginLoadContext {
  configDirectory(): string;
  cacheDirectory(): string;
}
