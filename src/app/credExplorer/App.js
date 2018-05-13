// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import {Graph} from "core/graph";
import basicPagerank from "./basicPagerank";
import LocalStore from "./LocalStore";
import type {PagerankResult} from "./basicPagerank";
import {PagerankTable} from "./pagerankTable";

type Props = {};
type State = {
  repoOwner: string,
  repoName: string,
  graph: ?Graph<mixed, mixed>,
  pagerankResult: ?PagerankResult,
};

const REPO_OWNER_KEY = "repoOwner";
const REPO_NAME_KEY = "repoName";

export default class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      repoOwner: "",
      repoName: "",
      graph: null,
      pagerankResult: null,
    };
  }

  componentDidMount() {
    this.setState((state) => ({
      repoOwner: LocalStore.get(REPO_OWNER_KEY, state.repoOwner),
      repoName: LocalStore.get(REPO_NAME_KEY, state.repoName),
    }));
  }

  render() {
    const {graph} = this.state;
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Cred Explorer</h1>
        </header>
        <p>Welcome to the SourceCred Explorer!</p>
        <PagerankTable
          graph={this.state.graph}
          pagerankResult={this.state.pagerankResult}
        />
        <div>
          <label>
            Repository owner:
            <input
              value={this.state.repoOwner}
              onChange={(e) => {
                const value = e.target.value;
                this.setState({repoOwner: value}, () => {
                  LocalStore.set(REPO_OWNER_KEY, this.state.repoOwner);
                });
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
                this.setState({repoName: value}, () => {
                  LocalStore.set(REPO_NAME_KEY, this.state.repoName);
                });
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
          <button
            disabled={graph == null}
            onClick={() => {
              setTimeout(() => {
                if (graph != null) {
                  const pagerankResult = basicPagerank(graph);
                  this.setState({pagerankResult});
                }
              }, 0);
            }}
          >
            Run basic PageRank
          </button>
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
