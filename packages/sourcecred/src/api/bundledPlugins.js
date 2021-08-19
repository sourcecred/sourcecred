// @flow

import type {Plugin} from "./plugin";
import {type PluginId, getPluginOwner} from "./pluginId";
import {GithubPlugin} from "../plugins/github/plugin";
import {DiscoursePlugin} from "../plugins/discourse/plugin";
import {DiscordPlugin} from "../plugins/discord/plugin";
import {InitiativesPlugin} from "../plugins/initiatives/plugin";
import {EthereumPlugin} from "../plugins/ethereum/plugin";
import {
  ExternalPlugin,
  ExternalPluginIdOwner,
} from "../plugins/external/plugin";
import {DiskStorage} from "../core/storage/disk";

/**
 * Returns an object mapping owner-name pairs to CLI plugin
 * declarations; keys are like `sourcecred/github`.
 */
// TODO(@decentralion): Fix the type signature here.
export function getPlugin(pluginId: PluginId): ?Plugin {
  const mapping = {
    "sourcecred/github": new GithubPlugin(),
    "sourcecred/discourse": new DiscoursePlugin(),
    "sourcecred/discord": new DiscordPlugin(),
    "sourcecred/initiatives": new InitiativesPlugin(),
    "sourcecred/ethereum": new EthereumPlugin(),
  };
  if (mapping[pluginId.toString()]) return mapping[pluginId.toString()];
  if (getPluginOwner(pluginId) === ExternalPluginIdOwner)
    return new ExternalPlugin({
      pluginId,
      storage: new DiskStorage(process.cwd()),
    });
}
