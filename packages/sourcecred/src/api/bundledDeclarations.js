// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import {declaration as githubDeclaration} from "../plugins/github/declaration";
import {declaration as discourseDeclaration} from "../plugins/discourse/declaration";
import {declaration as discordDeclaration} from "../plugins/discord/declaration";
import {declaration as initiativesDeclaration} from "../plugins/initiatives/declaration";
import {declaration as ethereumDeclaration} from "../plugins/ethereum/declaration";
import {type InstanceConfig} from "./instanceConfig";
import {type PluginId, getPluginOwner} from "./pluginId";
import {DataStorage} from "../core/storage";
import {
  ExternalPlugin,
  ExternalPluginIdOwner,
} from "../plugins/external/plugin";

export async function getPluginDeclaration(
  pluginId: PluginId,
  storage: DataStorage
): Promise<PluginDeclaration> {
  const mapping = {
    "sourcecred/github": githubDeclaration,
    "sourcecred/discourse": discourseDeclaration,
    "sourcecred/discord": discordDeclaration,
    "sourcecred/initiatives": initiativesDeclaration,
    "sourcecred/ethereum": ethereumDeclaration,
  };
  if (mapping[pluginId.toString()]) return mapping[pluginId.toString()];
  if (getPluginOwner(pluginId) === ExternalPluginIdOwner)
    return await new ExternalPlugin({pluginId, storage}).declaration();
  throw "Bad declaration: " + JSON.stringify(pluginId);
}

export async function upgradeInstanceConfig(
  raw: InstanceConfig,
  storage: DataStorage
): Promise<$ReadOnlyMap<PluginId, PluginDeclaration>> {
  const bundledPlugins = new Map();
  for (const id of raw.bundledPlugins) {
    const plugin = await getPluginDeclaration(id, storage);
    if (plugin == null) {
      throw new Error("bad bundled declaration: " + JSON.stringify(id));
    }
    bundledPlugins.set(id, plugin);
  }
  return bundledPlugins;
}
