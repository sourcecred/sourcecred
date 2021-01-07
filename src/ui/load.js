// @flow
import * as pluginId from "../api/pluginId";
import {CredView} from "../analysis/credView";
import {fromJSON as credResultFromJSON} from "../analysis/credResult";
import {Ledger} from "../core/ledger/ledger";
import {
  type CurrencyDetails,
  parser as currencyParser,
} from "../api/currencyConfig";

export type LoadResult = LoadSuccess | LoadFailure;
export type LoadSuccess = {|
  +type: "SUCCESS",
  +credView: CredView | null,
  +ledger: Ledger,
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
  +hasBackend: Boolean,
  +currency: CurrencyDetails,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export async function load(): Promise<LoadResult> {
  // TODO (@topocount) refactor to better
  // utilize functional programming best practices.
  // Optional loads require some better organization
  // than ternaries. There's also a lot of repeated code here
  const queries = [
    fetch("output/credResult.json"),
    fetch("sourcecred.json"),
    fetch("data/ledger.json"),
    fetch("static/server-info.json"),
    fetch("config/currencyDetails.json"),
  ];
  const responses = await Promise.all(queries);

  for (const response of responses.slice(1, 4)) {
    if (!response.ok) {
      console.error(response);
      return {type: "FAILURE", error: response.status};
    }
  }
  try {
    let credView = null;
    if (responses[0].ok) {
      const json = await responses[0].json();
      const credResult = credResultFromJSON(json);
      credView = new CredView(credResult);
    }
    const {bundledPlugins} = await responses[1].json();
    const rawLedger = await responses[2].text();
    const ledger = Ledger.parse(rawLedger);
    const {hasBackend} = await responses[3].json();
    const currencyResponse = responses[4];
    const currency = currencyParser.parseOrThrow(
      currencyResponse.ok ? await currencyResponse.json() : {}
    );
    return {
      type: "SUCCESS",
      credView,
      bundledPlugins,
      ledger,
      hasBackend,
      currency,
    };
  } catch (e) {
    console.error(e);
    return {type: "FAILURE", error: e};
  }
}
