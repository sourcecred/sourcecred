// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {StyleSheet, css} from "aphrodite/no-important";

async function loadAndReport(assets, path) {
  const url = assets.resolve(path);
  const response = await fetch(url);
  if (!response.ok) {
    console.error(path, response);
  }
  const json = await response.json();
  console.log(path, json);
}

export default class HomePage extends React.Component<{|+assets: Assets|}> {
  async componentDidMount() {
    loadAndReport(this.props.assets, "sourcecred.json");
    loadAndReport(this.props.assets, "output/credResult.json");
    loadAndReport(this.props.assets, "config/sourcecred/discourse/config.json");
  }

  render() {
    return (
      <div className={css(styles.container)}>
        <h1>Under Construction</h1>
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
