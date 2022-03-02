// @flow
import * as pluginId from "./pluginId";
import * as P from "../util/combo";
import {
  type RawConfigsByTarget,
  type ConfigsByTarget,
  rawConfigsByTargetParser,
  configsByTargetParser,
} from "../core/credequate/config";

export type RawInstanceConfig = {|
  // Plugin identifier, like `sourcecred/identity`. Version number is
  // implicit from the SourceCred version. This is a stopgap until we have
  // a plugin system that admits external, dynamically loaded
  // dependencies.
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
  +credEquatePlugins: $ReadOnlyArray<{|
    id: pluginId.PluginId,
    configsByTarget: RawConfigsByTarget,
  |}>,
|};
export type InstanceConfig = {|
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
  +credEquatePlugins: $ReadOnlyArray<{|
    id: pluginId.PluginId,
    configsByTarget: ConfigsByTarget,
  |}>,
|};

export const rawParser: P.Parser<RawInstanceConfig> = P.object(
  {
    bundledPlugins: P.array(pluginId.parser),
  },
  {
    credEquatePlugins: P.array(
      P.object({
        id: pluginId.parser,
        configsByTarget: rawConfigsByTargetParser,
      })
    ),
  }
).fmap((config) => ({credEquatePlugins: [], ...config}));

export const parser: P.Parser<InstanceConfig> = P.object(
  {
    bundledPlugins: P.array(pluginId.parser),
  },
  {
    credEquatePlugins: P.array(
      P.object({
        id: pluginId.parser,
        configsByTarget: configsByTargetParser,
      })
    ),
  }
).fmap((config) => ({credEquatePlugins: [], ...config}));
