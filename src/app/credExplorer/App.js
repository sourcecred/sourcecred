// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import LocalStore from "./LocalStore";
import {createPluginAdapter as createGithubAdapter} from "../../plugins/github/pluginAdapter";
import {createPluginAdapter as createGitAdapter} from "../../plugins/git/pluginAdapter";
import {Graph} from "../../core/graph";
import {pagerank, type PagerankResult} from "../../core/attribution/pagerank";
import {PagerankTable} from "./PagerankTable";
import type {PluginAdapter} from "../pluginAdapter";

type GraphWithMetadata = {|
  +graph: ?Graph,
  +pagerankResult: ?PagerankResult,
  adapters: ?$ReadOnlyArray<PluginAdapter>,
|};

type Props = {};
type State = {
  repoOwner: string,
  repoName: string,
  data: GraphWithMetadata,
};

const REPO_OWNER_KEY = "repoOwner";
const REPO_NAME_KEY = "repoName";

export default class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      repoOwner: "",
      repoName: "",
      data: {graph: null, pagerankResult: null, adapters: null},
    };
  }

  componentDidMount() {
    this.setState((state) => ({
      repoOwner: LocalStore.get(REPO_OWNER_KEY, state.repoOwner),
      repoName: LocalStore.get(REPO_NAME_KEY, state.repoName),
    }));
  }

  render() {
    const {graph, adapters, pagerankResult} = this.state.data;
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Cred Explorer</h1>
        </header>
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
          <button onClick={() => this.loadData()}>Load data</button>
          <button
            disabled={graph == null}
            onClick={() => {
              setTimeout(() => {
                if (graph != null) {
                  const edgeWeight = (_unused_Edge) => ({
                    toWeight: 1,
                    froWeight: 1,
                  });
                  const pagerankResult = pagerank(graph, edgeWeight, {
                    verbose: true,
                  });
                  const data = {graph, pagerankResult, adapters};
                  // In case a new graph was loaded while waiting for PageRank
                  if (this.state.data.graph === graph) {
                    this.setState({data});
                  }
                }
              }, 0);
            }}
          >
            Run basic PageRank
          </button>
          {graph ? (
            <p>
              Graph loaded: {Array.from(graph.nodes()).length} nodes,{" "}
              {Array.from(graph.edges()).length} edges.
            </p>
          ) : (
            <p>Graph not loaded.</p>
          )}
          <PagerankTable
            graph={graph}
            pagerankResult={pagerankResult}
            adapters={adapters}
          />
        </div>
      </div>
    );
  }

  loadData() {
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

    const githubPromise = createGithubAdapter(repoOwner, repoName).then(
      (adapter) => {
        const graph = adapter.graph();
        return {graph, adapter};
      }
    );

    const gitPromise = createGitAdapter(repoOwner, repoName).then((adapter) => {
      const graph = adapter.graph();
      return {graph, adapter};
    });

    Promise.all([gitPromise, githubPromise]).then((graphsAndAdapters) => {
      const graph = Graph.merge(graphsAndAdapters.map((x) => x.graph));
      const adapters = graphsAndAdapters.map((x) => x.adapter);
      const data = {graph, adapters, pagerankResult: null};
      this.setState({data});
    });
  }
}

const styles = StyleSheet.create({
  header: {
    color: "#090",
  },
});
