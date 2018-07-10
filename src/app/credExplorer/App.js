// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import LocalStore from "./LocalStore";
import {createPluginAdapter as createGithubAdapter} from "../../plugins/github/pluginAdapter";
import {createPluginAdapter as createGitAdapter} from "../../plugins/git/pluginAdapter";
import {Graph} from "../../core/graph";
import {pagerank, type NodeDistribution} from "../../core/attribution/pagerank";
import {PagerankTable} from "./PagerankTable";
import type {PluginAdapter} from "../pluginAdapter";
import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {WeightConfig} from "./WeightConfig";

import * as NullUtil from "../../util/null";

type Props = {};
type State = {
  repoOwner: string,
  repoName: string,
  data: {|
    graphWithMetadata: ?{|
      +graph: Graph,
      +adapters: $ReadOnlyArray<PluginAdapter>,
      +nodeCount: number,
      +edgeCount: number,
    |},
    +pagerankResult: ?NodeDistribution,
  |},
  edgeEvaluator: ?EdgeEvaluator,
};

const REPO_OWNER_KEY = "repoOwner";
const REPO_NAME_KEY = "repoName";

export default class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      repoOwner: "",
      repoName: "",
      data: {graphWithMetadata: null, pagerankResult: null},
      edgeEvaluator: null,
    };
  }

  componentDidMount() {
    this.setState((state) => ({
      repoOwner: LocalStore.get(REPO_OWNER_KEY, state.repoOwner),
      repoName: LocalStore.get(REPO_NAME_KEY, state.repoName),
    }));
  }

  render() {
    const {edgeEvaluator} = this.state;
    const {graphWithMetadata, pagerankResult} = this.state.data;
    return (
      <div style={{maxWidth: "66em", margin: "0 auto", padding: "0 10px"}}>
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
            disabled={graphWithMetadata == null || edgeEvaluator == null}
            onClick={() => {
              setTimeout(() => {
                if (graphWithMetadata == null || edgeEvaluator == null) {
                  throw new Error("Unexpected null value");
                }
                const {graph} = graphWithMetadata;
                const pagerankResult = pagerank(graph, edgeEvaluator, {
                  verbose: true,
                });
                const data = {graphWithMetadata, pagerankResult};
                // In case a new graph was loaded while waiting for
                // PageRank.
                const stomped =
                  this.state.data.graphWithMetadata &&
                  this.state.data.graphWithMetadata.graph !== graph;
                if (!stomped) {
                  this.setState({data});
                }
              }, 0);
            }}
          >
            Run basic PageRank
          </button>
          {graphWithMetadata ? (
            <p>
              Graph loaded: {graphWithMetadata.nodeCount} nodes,{" "}
              {graphWithMetadata.edgeCount} edges.
            </p>
          ) : (
            <p>Graph not loaded.</p>
          )}
          <WeightConfig onChange={(ee) => this.setState({edgeEvaluator: ee})} />
          <PagerankTable
            graph={NullUtil.map(graphWithMetadata, (x) => x.graph)}
            adapters={NullUtil.map(graphWithMetadata, (x) => x.adapters)}
            pagerankResult={pagerankResult}
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
      const data = {
        graphWithMetadata: {
          graph,
          adapters,
          nodeCount: Array.from(graph.nodes()).length,
          edgeCount: Array.from(graph.edges()).length,
        },
        pagerankResult: null,
      };
      this.setState({data});
    });
  }
}

const styles = StyleSheet.create({
  header: {
    color: "#090",
  },
});
