// @flow

import React from "react";

async function loadAndReport(path) {
  const response = await fetch(path);
  if (!response.ok) {
    console.error(path, response);
  }
  const json = await response.json();
  console.log(path, json);
}

export default class App extends React.Component<{||}> {
  async componentDidMount() {
    loadAndReport("sourcecred.json");
    loadAndReport("output/credResult.json");
    loadAndReport("config/sourcecred/discourse/config.json");
  }

  render() {
    return <h1>Under Construction</h1>;
  }
}
