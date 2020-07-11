// @flow

import tmp from "tmp";
import fs from "fs-extra";
import {type Plugin} from "./plugin";
import {fromString as pluginIdFromString} from "./pluginId";
import {NodeAddress, EdgeAddress} from "../core/graph";
import * as WeightedGraph from "../core/weightedGraph";
import {join} from "path";
import {DiskInstance} from "./diskInstance";
import {type RawInstanceConfig} from "./instanceConfig";
import * as diskUtil from "../util/disk";
import {SilentTaskReporter} from "../util/taskReporter";

describe("api/diskInstance", () => {
  const dummyPlugin: Plugin = {
    id: pluginIdFromString("sourcecred/dummy"),
    declaration: () => ({
      name: "dummy",
      nodeTypes: [],
      edgeTypes: [],
      nodePrefix: NodeAddress.empty,
      edgePrefix: EdgeAddress.empty,
      userTypes: [],
    }),
    load: async (pluginDirectoryContext) => {
      const cache = pluginDirectoryContext.cacheDirectory();
      const fpath = join(cache, "cache.txt");
      await fs.writeFile(fpath, "loaded");
    },
    graph: async () => {
      return WeightedGraph.empty();
    },
    referenceDetector: async () => {
      return {addressFromUrl: () => undefined};
    },
  };

  function setupInstanceDirectory(config: RawInstanceConfig) {
    const dir = tmp.dirSync().name;
    fs.writeFileSync(join(dir, "sourcecred.json"), JSON.stringify(config));
    return dir;
  }

  async function example() {
    const config = {bundledPlugins: [dummyPlugin.id]};
    const dir = setupInstanceDirectory(config);
    const reporter = new SilentTaskReporter();
    const plugins = [dummyPlugin];
    const instance = await DiskInstance.instantiate(dir, plugins, reporter);
    return {config, dir, reporter, plugins, instance};
  }

  describe("constructor", () => {
    it("defaults to a new SilentTaskReporter if none is provided", () => {
      const plugins = new Map();
      const instanceDirectory = "fake/path";
      const instance = new DiskInstance(instanceDirectory, plugins);
      expect(instance._taskReporter).toBeInstanceOf(SilentTaskReporter);
    });
  });

  describe("accessors", () => {
    it("can access the instance directory", async () => {
      const {dir, instance} = await example();
      expect(instance.instanceDirectory()).toEqual(dir);
    });
    it("can access the plugins", async () => {
      const {plugins, instance} = await example();
      expect(instance.plugins()).toEqual(plugins);
    });
  });

  describe("instantiate", () => {
    it("errors if the path does not exist", async () => {
      const name = tmp.tmpNameSync();
      const fail = DiskInstance.instantiate(name, []);
      await expect(fail).rejects.toThrow(
        `cannot load instance: ${name} doesn't exist`
      );
    });
    it("errors if the path is not a directory", async () => {
      const path = tmp.tmpNameSync();
      fs.writeFileSync(path, "foo");
      const fail = DiskInstance.instantiate(path, []);
      await expect(fail).rejects.toThrow(
        `cannot load instance: ${path} is not a directory`
      );
    });
    it("errors if there is no config file", async () => {
      const path = tmp.dirSync().name;
      diskUtil.mkdirx(path);
      const fail = DiskInstance.instantiate(path, []);
      await expect(fail).rejects.toThrow(
        `no sourcecred.json file present in ${path}`
      );
    });
    it("errors if the config file can't isn't valid json", async () => {
      const name = tmp.dirSync().name;
      fs.writeFileSync(join(name, "sourcecred.json"), "oops");
      const fail = DiskInstance.instantiate(name, []);
      await expect(fail).rejects.toThrow("error parsing sourcecred.json");
    });
    it("errors if the config file can't be parsed", async () => {
      const name = tmp.dirSync().name;
      fs.writeFileSync(join(name, "sourcecred.json"), JSON.stringify("{}"));
      const fail = DiskInstance.instantiate(name, []);
      await expect(fail).rejects.toThrow("error parsing sourcecred.json");
    });
    it("errors if a plugin is not available", async () => {
      const config = {bundledPlugins: [dummyPlugin.id]};
      const dir = setupInstanceDirectory(config);
      const fail = DiskInstance.instantiate(dir, []);
      await expect(fail).rejects.toThrow(
        "plugin sourcecred/dummy not available"
      );
    });
    it("handles the case wth no plugins", async () => {
      const config = {bundledPlugins: []};
      const dir = setupInstanceDirectory(config);
      const di = await DiskInstance.instantiate(dir, []);
      expect(di.plugins()).toEqual([]);
    });
    it("works in a case with plugins", async () => {
      const config = {bundledPlugins: [dummyPlugin.id]};
      const dir = setupInstanceDirectory(config);
      const di = await DiskInstance.instantiate(dir, [dummyPlugin]);
      expect(di.plugins()).toEqual([dummyPlugin]);
    });
  });
});
