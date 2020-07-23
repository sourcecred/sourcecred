// @flow
import * as pluginId from "../api/pluginId";
import {CredView} from "../analysis/credView";
import {fromJSON as credResultFromJSON} from "../analysis/credResult";
import {Ledger, parser as ledgerParser} from "../ledger/ledger";

export type LoadResult = LoadSuccess | LoadFailure;
export type LoadSuccess = {|
  +type: "SUCCESS",
  +credView: CredView,
  +ledger: Ledger,
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export async function load(): Promise<LoadResult> {
  const queries = [
    fetch("output/credResult.json"),
    fetch("/sourcecred.json"),
    fetch("data/ledger.json"),
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
    const ledgerJson = await responses[2].json();
    const ledger = ledgerParser.parseOrThrow(ledgerJson);
    return {type: "SUCCESS", credView, bundledPlugins, ledger};
  } catch (e) {
    console.error(e);
    return {type: "FAILURE", error: e};
  }
}
