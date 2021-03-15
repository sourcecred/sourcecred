// @flow
import * as pluginId from "../api/pluginId";
import {CredGraph} from "../core/credrank/credGraph";
import {
  type CurrencyDetails,
  parser as currencyParser,
} from "../api/currencyConfig";
import {LedgerManager} from "../api/ledgerManager";
import {createLedgerDiskStorage} from "./utils/ledgerDiskStorage";

export type LoadResult = LoadSuccess | LoadFailure;
export type LoadSuccess = {|
  +type: "SUCCESS",
  +ledgerManager: LedgerManager,
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
  +hasBackend: Boolean,
  +currency: CurrencyDetails,
  +credGraph: CredGraph | null,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export async function load(): Promise<LoadResult> {
  // TODO (@topocount) refactor to better
  // utilize functional programming best practices.
  // Optional loads require some better organization
  // than ternaries. There's also a lot of repeated code here

  const diskStorage = createLedgerDiskStorage("data/ledger.json");
  const ledgerManager = new LedgerManager({
    storage: diskStorage,
  });

  const queries = [
    fetch("sourcecred.json"),
    fetch("static/server-info.json"),
    fetch("config/currencyDetails.json"),
    fetch("output/credGraph.json"),
  ];
  const responses = await Promise.all(queries);

  for (const response of responses.slice(0, 2)) {
    if (!response.ok) {
      console.error(response);
      return {type: "FAILURE", error: response.status};
    }
  }
  try {
    let credGraph = null;
    const {bundledPlugins} = await responses[0].json();
    const {hasBackend} = await responses[1].json();
    const currencyResponse = responses[2];
    const currency = currencyParser.parseOrThrow(
      currencyResponse.ok ? await currencyResponse.json() : {}
    );
    if (responses[3].ok) {
      const json = await responses[3].json();
      credGraph = CredGraph.fromJSON(json);
    }
    const ledgerResult = await ledgerManager.reloadLedger();
    if (ledgerResult.error) {
      return {
        type: "FAILURE",
        error: `Error processing ledger events: ${ledgerResult.error}`,
      };
    }

    return {
      type: "SUCCESS",
      bundledPlugins,
      ledgerManager,
      hasBackend,
      currency,
      credGraph,
    };
  } catch (e) {
    console.error(e);
    return {type: "FAILURE", error: e};
  }
}
