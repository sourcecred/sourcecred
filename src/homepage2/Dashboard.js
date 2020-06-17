// @flow

import React from "react";

// TODO(@decentralion): Remove dep on cli2, move instanceConfig to core
import {type RawInstanceConfig} from "../cli2/instanceConfig";

import {
  type CredResult,
  fromJSON as credResultFromJSON,
} from "../analysis/credResult";

import type {Assets} from "../webutil/assets";
import {StyleSheet, css} from "aphrodite/no-important";

// TODO(@decentralion): Add typesafe parsing
async function loadJson(assets, path): Promise<any> {
  const url = assets.resolve(path);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(path, response);
  }
  const json = await response.json();
  return json;
}

export type Props = {|
  +assets: Assets,
|};

export type State = {|
  instanceConfig: RawInstanceConfig | null,
  credResult: CredResult | null,
|};

export default class HomePage extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {instanceConfig: null, credResult: null};
  }
  async componentDidMount() {
    const instanceConfig = await loadJson(this.props.assets, "sourcecred.json");
    const credResultJson = await loadJson(
      this.props.assets,
      "output/credResult.json"
    );
    const credResult = credResultFromJSON(credResultJson);
    this.state = {instanceConfig, credResult};
    console.log(this.state);
  }

  render() {
    return (
      <div className={css(styles.container)}>
        <h1>Dashboard Under Construction</h1>
      </div>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 900,
    margin: "0 auto",
    marginBottom: 200,
    padding: "0 10px",
    lineHeight: 1.5,
    fontSize: 20,
  },
});
