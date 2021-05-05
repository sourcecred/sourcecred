// @flow
import * as pluginId from "../api/pluginId";
import {
  CredGraph,
  jsonParser as credGraphJsonParser,
} from "../core/credrank/credGraph";
import {
  type CurrencyDetails,
  parser as currencyParser,
  defaultCurrencyConfig,
} from "../api/currencyConfig";
import {LedgerManager} from "../api/ledgerManager";
import {rawParser as rawInstanceConfigParser} from "../api/rawInstanceConfig";
import {createLedgerDiskStorage} from "./utils/ledgerDiskStorage";
import * as Combo from "../util/combo";
import {OriginStorage} from "../core/storage/originStorage";
import {ZipStorage} from "../core/storage/zip";
import {loadJson, loadJsonWithDefault} from "../util/storage";
import {type PluginDeclaration} from "../analysis/pluginDeclaration";
import {upgradeRawInstanceConfig} from "../api/bundledDeclarations";

export type LoadResult = LoadSuccess | LoadFailure;
export type LoadSuccess = {|
  +type: "SUCCESS",
  +ledgerManager: LedgerManager,
  +bundledPlugins: $ReadOnlyMap<pluginId.PluginId, PluginDeclaration>,
  +hasBackend: boolean,
  +currency: CurrencyDetails,
  +credGraph: CredGraph | null,
  +isDev: boolean,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export type BackendConfig = {|+hasBackend: boolean|};
export const backendParser: Combo.Parser<BackendConfig> = Combo.object({
  hasBackend: Combo.boolean,
});

export async function load(): Promise<LoadResult> {
  // TODO (@topocount) refactor to better
  // utilize functional programming best practices.
  // Optional loads require some better organization
  // than ternaries. There's also a lot of repeated code here

  const diskStorage = createLedgerDiskStorage("data/ledger.json");
  const originStorage = new OriginStorage("");
  const ledgerManager = new LedgerManager({
    storage: diskStorage,
  });

  const queries = [
    loadJson(originStorage, "sourcecred.json", rawInstanceConfigParser),
    loadJson(originStorage, "static/server-info.json", backendParser),
    loadJsonWithDefault(
      originStorage,
      "config/currencyDetails.json",
      currencyParser,
      defaultCurrencyConfig
    ),
    loadJsonWithDefault(
      new ZipStorage(originStorage),
      "output/credGraph.json.gzip",
      Combo.fmap(credGraphJsonParser, (graphJson) =>
        CredGraph.fromJSON(graphJson)
      ),
      () => null
    ),
  ];
  try {
    const [
      rawInstanceConfig,
      {hasBackend},
      currency,
      credGraph,
    ] = await Promise.all(queries);

    const ledgerResult = await ledgerManager.reloadLedger();
    if (ledgerResult.error) {
      return {
        type: "FAILURE",
        error: `Error processing ledger events: ${ledgerResult.error}`,
      };
    }
    const bundledPlugins = upgradeRawInstanceConfig(rawInstanceConfig);
    const isDev = new URLSearchParams(location.search).get("dev") === "true";
    return {
      type: "SUCCESS",
      bundledPlugins,
      ledgerManager,
      hasBackend,
      currency,
      credGraph,
      isDev,
    };
  } catch (e) {
    console.error(e);
    return {type: "FAILURE", error: e};
  }
}
