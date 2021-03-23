// @flow

import {join as pathJoin} from "path";
import fs from "fs-extra";
import {mkdirx} from "../util/disk";
import {loadJson} from "../util/storage";

import {DiskStorage} from "../core/storage/disk";
import {ZipStorage} from "../core/storage/zip";
import {WritableDataStorage} from "../core/storage/index";
import type {PluginDirectoryContext} from "../api/plugin";
import {
  parser as configParser,
  type InstanceConfig,
} from "../api/instanceConfig";
import {Ledger} from "../core/ledger/ledger";
import {CredGraph, parser as credGraphParser} from "../core/credrank/credGraph";
import {loadFileWithDefault, loadJsonWithDefault} from "../util/storage";
import {
  parser as currencyConfigParser,
  type CurrencyDetails,
} from "../api/currencyConfig";
import {defaultCurrencyConfig} from "../api/currencyConfig";
import {fromString as verifyPluginId} from "../api/pluginId";

export function loadInstanceConfig(baseDir: string): Promise<InstanceConfig> {
  const storage = new DiskStorage(baseDir);
  const projectFilePath = pathJoin("sourcecred.json");
  return loadJson(storage, projectFilePath, configParser);
}

export function makePluginDir(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): string {
  const {absolutePath} = _makeDirectories(baseDir, prefix, pluginId);
  return absolutePath;
}

// For use with DataStorage implementations
export function makeRelativePluginDir(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): string {
  const {relativePath} = _makeDirectories(baseDir, prefix, pluginId);
  return relativePath;
}

function _makeDirectories(
  baseDir: string,
  prefix: $ReadOnlyArray<string>,
  pluginId: string
): {relativePath: string, absolutePath: string} {
  verifyPluginId(pluginId);
  const idParts = pluginId.split("/");

  const [pluginOwner, pluginName] = idParts;
  const pathComponents = [...prefix, pluginOwner, pluginName];
  let path = baseDir;
  for (const pc of pathComponents) {
    path = pathJoin(path, pc);
    mkdirx(path);
  }

  return {absolutePath: path, relativePath: pathJoin(...pathComponents)};
}

export function pluginDirectoryContext(
  baseDir: string,
  pluginName: string
): PluginDirectoryContext {
  const cacheDir = makePluginDir(baseDir, ["cache"], pluginName);
  const configDir = makePluginDir(baseDir, ["config", "plugins"], pluginName);
  return {
    configDirectory() {
      return configDir;
    },
    cacheDirectory() {
      return cacheDir;
    },
  };
}

export async function loadCredGraph(baseDir: string): Promise<CredGraph> {
  const storage = new ZipStorage(new DiskStorage(baseDir));
  const credGraphPath = pathJoin("output", "credGraph.json.gzip");
  return await loadJson(storage, credGraphPath, credGraphParser);
}

export async function loadLedger(baseDir: string): Promise<Ledger> {
  const ledgerPath = pathJoin("data", "ledger.json");
  const storage = new DiskStorage(baseDir);
  return Ledger.parse(
    await loadFileWithDefault(storage, ledgerPath, () =>
      new Ledger().serialize()
    )
  );
}

export async function saveLedger(
  baseDir: string,
  ledger: Ledger
): Promise<void> {
  const ledgerPath = pathJoin(baseDir, "data", "ledger.json");
  await fs.writeFile(ledgerPath, ledger.serialize());
}

/**
 * Load the currency details from config, falling back on defaults
 * if need be.
 */
export async function loadCurrencyDetails(
  storage: WritableDataStorage,
  currencyDetailsPath: string
): Promise<CurrencyDetails> {
  return await loadJsonWithDefault(
    storage,
    currencyDetailsPath,
    currencyConfigParser,
    defaultCurrencyConfig
  );
}
