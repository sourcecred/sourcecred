// @flow
import React from "react";
import {Explorer} from "./Explorer.js";
import {load, type LoadResult} from "../../load";

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
