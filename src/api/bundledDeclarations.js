// @flow

import type {PluginDeclaration} from "../analysis/pluginDeclaration";
import {declaration as githubDeclaration} from "../plugins/github/declaration";
import {declaration as discourseDeclaration} from "../plugins/discourse/declaration";
import {declaration as discordDeclaration} from "../plugins/discord/declaration";
import {declaration as initiativesDeclaration} from "../plugins/initiatives/declaration";
import {declaration as ethereumDeclaration} from "../plugins/ethereum/declaration";
import {type RawInstanceConfig} from "./rawInstanceConfig";
import {type PluginId} from "./pluginId";

export function bundledDeclarations(): {[pluginId: string]: PluginDeclaration} {
  return {
    "sourcecred/github": githubDeclaration,
    "sourcecred/discourse": discourseDeclaration,
    "sourcecred/discord": discordDeclaration,
    "sourcecred/initiatives": initiativesDeclaration,
    "sourcecred/ethereum": ethereumDeclaration,
  };
}

export function upgradeRawInstanceConfig(
  raw: RawInstanceConfig
): $ReadOnlyMap<PluginId, PluginDeclaration> {
  const allBundledPlugins = bundledDeclarations();
  const bundledPlugins = new Map();
  for (const id of raw.bundledPlugins) {
    const plugin = allBundledPlugins[id];
    if (plugin == null) {
      throw new Error("bad bundled plugin: " + JSON.stringify(id));
    }
    bundledPlugins.set(id, plugin);
  }
  return bundledPlugins;
}
