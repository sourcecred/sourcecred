// @flow

import React from "react";
import {fromJSON as credResultFromJSON} from "../analysis/credResult";
import {CredView} from "../analysis/credView";
import {Explorer} from "./Explorer.js";
import {LedgerAdmin} from "./Admin";

export type LoadResult = LoadSuccess | LoadFailure;
export type LoadSuccess = {|
  +type: "SUCCESS",
  +credView: CredView,
|};
export type LoadFailure = {|+type: "FAILURE", +error: any|};

export async function load(): Promise<LoadResult> {
  const response = await fetch("output/credResult.json");
  if (!response.ok) {
    console.error(response);
    return {type: "FAILURE", error: response.status};
  }
  try {
    const json = await response.json();
    const credResult = credResultFromJSON(json);
    const credView = new CredView(credResult);
    return {type: "SUCCESS", credView};
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
    if (1) {
      // Hack Hack Hack
      return <LedgerAdmin />;
    }
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
