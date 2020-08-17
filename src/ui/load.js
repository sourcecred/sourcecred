// @flow
import * as pluginId from "../api/pluginId";
import {CredView} from "../analysis/credView";
import {fromJSON as credResultFromJSON} from "../analysis/credResult";
import {Ledger} from "../ledger/ledger";
import {DEFAULT_SUFFIX} from "../ledger/grain.js";
import {parser as grainConfigParser} from "../api/grainConfig";

export type LoadResult = LoadSuccess | LoadFailure;
export type CurrencyDetails = {|+name: string, +suffix: string|};
export type LoadSuccess = {|
  +type: "SUCCESS",
  +credView: CredView,
  +ledger: Ledger,
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
  +hasBackend: Boolean,
  +currency: CurrencyDetails,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export async function load(): Promise<LoadResult> {
  const queries = [
    fetch("output/credResult.json"),
    fetch("sourcecred.json"),
    fetch("data/ledger.json"),
    fetch("static/server-info.json"),
    fetch("config/grain.json"),
  ];
  const responses = await Promise.all(queries);

  for (const response of responses) {
    if (!response.ok) {
      console.error(response);
      return {type: "FAILURE", error: response.status};
    }
  }
  try {
    const json = await responses[0].json();
    const credResult = credResultFromJSON(json);
    const credView = new CredView(credResult);
    const {bundledPlugins} = await responses[1].json();
    const rawLedger = await responses[2].text();
    const ledger = Ledger.parse(rawLedger);
    const {hasBackend} = await responses[3].json();
    const {
      currencySuffix: suffix = DEFAULT_SUFFIX,
      currencyName: name = "Grain",
    } = grainConfigParser.parseOrThrow(await responses[4].json());
    return {
      type: "SUCCESS",
      credView,
      bundledPlugins,
      ledger,
      hasBackend,
      currency: {name, suffix},
    };
  } catch (e) {
    console.error(e);
    return {type: "FAILURE", error: e};
  }
}
