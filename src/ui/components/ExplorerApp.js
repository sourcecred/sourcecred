// @flow

import React from "react";
import {fromJSON as credResultFromJSON} from "../../analysis/credResult";
import {CredView} from "../../analysis/credView";
import {Explorer} from "./Explorer.js";
import * as pluginId from "../../api/pluginId";

export type LoadResult = LoadSuccess | LoadFailure;
export type LoadSuccess = {|
  +type: "SUCCESS",
  +credView: CredView,
  +bundledPlugins: $ReadOnlyArray<pluginId.PluginId>,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export async function load(): Promise<LoadResult> {
  const queries = [fetch("output/credResult.json"), fetch("/sourcecred.json")];
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
    return {type: "SUCCESS", credView, bundledPlugins};
  } catch (e) {
    console.error(e);
    return {type: "FAILURE", error: e};
  }
}

export type Props = {||};
export type State = {|
  loadResult: LoadResult | null,
|};

export default class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {loadResult: null};
  }
  async componentDidMount() {
    this.setState({loadResult: await load()});
  }

  render() {
    const {loadResult} = this.state;
    if (loadResult == null) {
      return <h1>Loading...</h1>;
    }
    switch (loadResult.type) {
      case "FAILURE":
        return (
          <div>
            <h1>Load Failure</h1>
            <p>Check console for details.</p>
          </div>
        );
      case "SUCCESS":
        return <Explorer initialView={loadResult.credView} />;
      default:
        throw new Error((loadResult.type: empty));
    }
  }
}
