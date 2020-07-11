// @flow

import {join} from "path";
import fs from "fs-extra";
import {type PluginId} from "./pluginId";
import {type Plugin} from "./plugin";
import {rawParser} from "./instanceConfig";
import {type TaskReporter, SilentTaskReporter} from "../util/taskReporter";

export class DiskInstance {
  +_instanceDirectory: string;
  +_plugins: $ReadOnlyMap<PluginId, Plugin>;
  +_taskReporter: TaskReporter;

  constructor(
    instanceDirectory: string,
    plugins: $ReadOnlyMap<PluginId, Plugin>,
    // The TaskReporter that will receive task timing info from Plugin methods.
    // Defaults to the SilentTaskReporter.
    taskReporter: ?TaskReporter
  ) {
    this._instanceDirectory = instanceDirectory;
    this._plugins = plugins;
    this._taskReporter = taskReporter || new SilentTaskReporter();
  }

  /**
   * Gets the filesystem directory containing this Instance.
   */
  instanceDirectory(): string {
    return this._instanceDirectory;
  }

  /**
   * Gets the Plugins that are active in this instance.
   */
  plugins(): $ReadOnlyArray<Plugin> {
    return Array.from(this._plugins.values());
  }

  /**
   * Instantiate a DiskInstance from an existing SourceCred directory.
   *
   * Arguments:
   * - instanceDirectory: a valid SourceCred instance directory (i.e. has a
   *   sourcecred.json file)
   * - availablePlugins: runtime instantiations of all the bundled plugins
   *   present in the instance
   * - taskReporter: an optional TaskReporter that will receive logging info
   *   from plugins as they progress in loads, etc.
   *   Defaults to the SilentTaskReporter.
   */
  static async instantiate(
    instanceDirectory: string,
    availablePlugins: $ReadOnlyArray<Plugin>,
    taskReporter: ?TaskReporter
  ) {
    try {
      var stat = await fs.lstat(instanceDirectory);
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new Error(
          `cannot load instance: ${instanceDirectory} doesn't exist`
        );
      }
      throw new Error(`cannot load instance: ${e}`);
    }
    if (!stat.isDirectory()) {
      throw new Error(
        `cannot load instance: ${instanceDirectory} is not a directory`
      );
    }

    const configPath = join(instanceDirectory, "sourcecred.json");
    try {
      var configContents = await fs.readFile(configPath);
    } catch (e) {
      if (e.code === "ENOENT") {
        throw new Error(
          `no sourcecred.json file present in ${instanceDirectory}`
        );
      }
      throw new Error(`error loading sourcecred.json: ${e}`);
    }
    try {
      var config = rawParser.parseOrThrow(JSON.parse(configContents));
    } catch (e) {
      throw new Error(`error parsing sourcecred.json: ${e}`);
    }
    const {bundledPlugins} = config;
    const pluginSet = new Set(bundledPlugins);
    const plugins = new Map(availablePlugins.map((p) => [p.id, p]));
    const result = new Map();
    for (const id of pluginSet) {
      const plugin = plugins.get(id);
      if (plugin == null) {
        throw new Error(`plugin ${id} not available`);
      }
      result.set(id, plugin);
    }
    return new DiskInstance(instanceDirectory, result, taskReporter);
  }
}
