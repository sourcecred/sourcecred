// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import {Graph} from "../../core/graph";

type Props = {};
type State = {
  repoOwner: string,
  repoName: string,
  graph: ?Graph<mixed, mixed>,
};

export default class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      repoOwner: "",
      repoName: "",
      graph: null,
    };
  }

  render() {
    const {graph} = this.state;
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Cred Explorer</h1>
        </header>
        <p>Welcome to the SourceCred Explorer!</p>
        <div>
          <label>
            Repository owner:
            <input
              value={this.state.repoOwner}
              onChange={(e) => {
                const value = e.target.value;
                this.setState({repoOwner: value});
              }}
            />
          </label>
          <br />
          <label>
            Repository name:
            <input
              value={this.state.repoName}
              onChange={(e) => {
                const value = e.target.value;
                this.setState({repoName: value});
              }}
            />
          </label>
          <br />
          <button onClick={() => this.loadGraph()}>Load graph</button>
          {graph ? (
            <p>
              Graph loaded: {graph.nodes().length} nodes, {graph.edges().length}{" "}
              edges.
            </p>
          ) : (
            <p>Graph not loaded.</p>
          )}
        </div>
      </div>
    );
  }

  loadGraph() {
    const validRe = /^[A-Za-z0-9_-]+$/;
    const {repoOwner, repoName} = this.state;
    if (!repoOwner.match(validRe)) {
      console.error(`Invalid repository owner: ${JSON.stringify(repoOwner)}`);
      return;
    }
    if (!repoName.match(validRe)) {
      console.error(`Invalid repository name: ${JSON.stringify(repoName)}`);
      return;
    }
    fetch(`/api/v1/data/graphs/${repoOwner}/${repoName}/graph.json`)
      .then((resp) => (resp.ok ? resp.json() : Promise.reject(resp)))
      .then((json) => Graph.fromJSON(json))
      .then((graph) => {
        this.setState({graph});
      })
      .catch((e) => {
        console.error("Error while fetching:", e);
      });
  }
}

const styles = StyleSheet.create({
  header: {
    color: "#f0f",
  },
});
