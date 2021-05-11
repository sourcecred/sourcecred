// @flow

import {ReadOnlyInstance} from "./instance";
import {type CredrankInput} from "../main/credrank";
import {type WeightedGraph} from "../../core/weightedGraph";
import {type GraphInput} from "../main/graph";
import {type GrainInput} from "../main/grain";
import {type AnalysisInput} from "../main/analysis";
import {join as pathJoin} from "path";
import {
  loadJson,
  loadFileWithDefault,
  loadJsonWithDefault,
} from "../../util/storage";
import {
  CredGraph,
  parser as credGraphParser,
} from "../../core/credrank/credGraph";
import {Ledger} from "../../core/ledger/ledger";
import {NetworkStorage} from "../../core/storage/networkStorage";
import {OriginStorage} from "../../core/storage/originStorage";
import {ZipStorage} from "../../core/storage/zip";
import {DataStorage} from "../../core/storage";
import {type GrainConfig, parser as grainConfigParser} from "../grainConfig";
import {
  parser as currencyConfigParser,
  type CurrencyDetails,
} from "../currencyConfig";
import {defaultCurrencyConfig} from "../currencyConfig";

export const getNetworkReadInstance = (base: string): ReadInstance =>
  new ReadInstance(new NetworkStorage(base));
export const getOriginReadInstance = (base: string): ReadInstance =>
  new ReadInstance(new OriginStorage(base));

const GRAIN_PATH: $ReadOnlyArray<string> = ["config", "grain.json"];
const CURRENCY_PATH: $ReadOnlyArray<string> = [
  "config",
  "currencyDetails.json",
];
const LEDGER_PATH: $ReadOnlyArray<string> = ["data", "ledger.json"];
const CREDGRAPH_PATH: $ReadOnlyArray<string> = [
  "output",
  "credGraph.json.gzip",
];

/**
This is an Instance implementation that reads and writes using relative paths
on the given base URL. The base URL given should end with a trailing slash.
 */
export class ReadInstance implements ReadOnlyInstance {
  _storage: DataStorage;
  _zipStorage: ZipStorage;

  constructor(storage: DataStorage) {
    this._storage = storage;
    this._zipStorage = new ZipStorage(this._storage);
  }

  async readGraphInput(): Promise<GraphInput> {
    throw "not yet implemented";
  }

  async readCredrankInput(): Promise<CredrankInput> {
    throw "not yet implemented";
  }

  async readGrainInput(): Promise<GrainInput> {
    const [
      credGraph,
      ledger,
      grainConfig,
      currencyDetails,
    ] = await Promise.all([
      this.readCredGraph(),
      this.readLedger(),
      this.readGrainConfig(),
      this.readCurrencyDetails(),
    ]);
    return {
      credGraph,
      ledger,
      grainConfig,
      currencyDetails,
    };
  }

  async readAnalysisInput(): Promise<AnalysisInput> {
    throw "not yet implemented";
  }

  async readWeightedGraphForPlugin(): Promise<WeightedGraph> {
    throw "not yet implemented";
  }

  async readCredGraph(): Promise<CredGraph> {
    const credGraphPath = pathJoin(...CREDGRAPH_PATH);
    return await loadJson(this._zipStorage, credGraphPath, credGraphParser);
  }

  async readLedger(): Promise<Ledger> {
    const ledgerPath = pathJoin(...LEDGER_PATH);
    return loadFileWithDefault(this._storage, ledgerPath, () =>
      new Ledger().serialize()
    ).then((result) => Ledger.parse(result));
  }

  async readGrainConfig(): Promise<GrainConfig> {
    const grainConfigPath = pathJoin(...GRAIN_PATH);
    return loadJson(this._storage, grainConfigPath, grainConfigParser);
  }

  async readCurrencyDetails(): Promise<CurrencyDetails> {
    const currencyDetailsPath = pathJoin(...CURRENCY_PATH);
    return loadJsonWithDefault(
      this._storage,
      currencyDetailsPath,
      currencyConfigParser,
      defaultCurrencyConfig
    );
  }
}
