// @flow

import {mkdirx} from "../../util/disk";
import {DiskStorage} from "../../core/storage/disk";
import {
  parser as configParser,
  type InstanceConfigWithPlugins,
} from "../instanceConfigWithPlugins";
import {WriteInstance} from "./writeInstance";
import type {GraphInput} from "../main/graph";
import {join as pathJoin} from "path";
import {loadJson} from "../../util/storage";
import type {ContributionsInput} from "../main/contributions";

const INSTANCE_CONFIG_PATH: $ReadOnlyArray<string> = ["sourcecred.json"];

/**
This is an Instance implementation that reads and writes using relative paths
on the local disk.
 */
export class LocalInstance extends WriteInstance {
  constructor(baseDirectory: string) {
    super(new DiskStorage(baseDirectory));
  }

  //////////////////////////////
  //  Interface Functions
  //////////////////////////////

  async readContributionsInput(): Promise<ContributionsInput> {
    const instanceConfig = await this.readInstanceConfigWithPlugins();
    const ledger = await this.readLedger();
    const plugins = [];
    for (const {
      id: pluginId,
      plugin,
      configsByTarget,
    } of instanceConfig.credEquatePlugins) {
      plugins.push({
        pluginId,
        plugin,
        directoryContext: this.pluginDirectoryContext(pluginId),
        configsByTarget,
      });
    }
    return {
      plugins,
      ledger,
    };
  }

  async readGraphInput(): Promise<GraphInput> {
    const [instanceConfig, ledger] = await Promise.all([
      this.readInstanceConfigWithPlugins(),
      this.readLedger(),
    ]);
    const plugins = [];
    for (const [pluginId, plugin] of instanceConfig.bundledPlugins.entries()) {
      plugins.push({
        pluginId,
        plugin,
        directoryContext: this.pluginDirectoryContext(pluginId),
      });
    }
    return {
      plugins,
      ledger,
    };
  }

  //////////////////////////////
  //  Private Functions
  //////////////////////////////

  async readInstanceConfigWithPlugins(): Promise<InstanceConfigWithPlugins> {
    const pluginsConfigPath = pathJoin(...INSTANCE_CONFIG_PATH);
    return loadJson(this._storage, pluginsConfigPath, configParser);
  }

  mkdir(path: string) {
    mkdirx(path);
  }
}
