// @flow

export type InstanceConfig = {|
  +bundledPlugins: $ReadOnlyArray<BundledPluginSpec>,
|};

// Plugin identifier, like `sourcecred/identity`. Version number is
// implicit from the SourceCred version. This is a stopgap until we have
// a plugin system that admits external, dynamically loaded
// dependencies.
export type BundledPluginSpec = string;

type JsonObject =
  | string
  | number
  | boolean
  | null
  | JsonObject[]
  | {[string]: JsonObject};

export function parse(raw: JsonObject): InstanceConfig {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("bad config: " + JSON.stringify(raw));
  }
  const {bundledPlugins: rawBundledPlugins} = raw;
  if (!Array.isArray(rawBundledPlugins)) {
    throw new Error(
      "bad bundled plugins: " + JSON.stringify(rawBundledPlugins)
    );
  }
  const bundledPlugins = rawBundledPlugins.map((x) => {
    if (typeof x !== "string") {
      throw new Error("bad bundled plugin: " + JSON.stringify(x));
    }
    return x;
  });
  return {bundledPlugins};
}
