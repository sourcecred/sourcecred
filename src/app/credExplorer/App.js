// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import type {LocalStore} from "../localStore";
import CheckedLocalStore from "../checkedLocalStore";
import BrowserLocalStore from "../browserLocalStore";

import {StaticPluginAdapter as GithubAdapter} from "../../plugins/github/pluginAdapter";
import {StaticPluginAdapter as GitAdapter} from "../../plugins/git/pluginAdapter";
import {Graph} from "../../core/graph";
import {pagerank} from "../../core/attribution/pagerank";
import {PagerankTable} from "./PagerankTable";
import type {DynamicPluginAdapter} from "../pluginAdapter";
import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {WeightConfig} from "./WeightConfig";
import type {PagerankNodeDecomposition} from "../../core/attribution/pagerankNodeDecomposition";
import RepositorySelect from "./RepositorySelect";
import type {Repo} from "../../core/repo";

import * as NullUtil from "../../util/null";

export default class AppPage extends React.Component<{||}> {
  static _LOCAL_STORE = new CheckedLocalStore(
    new BrowserLocalStore({
      version: "1",
      keyPrefix: "cred-explorer",
    })
  );

  render() {
    return <App localStore={AppPage._LOCAL_STORE} />;
  }
}

type Props = {|+localStore: LocalStore|};
type State = {
  selectedRepo: ?Repo,
  data: {|
    graphWithMetadata: ?{|
      +graph: Graph,
      +adapters: $ReadOnlyArray<DynamicPluginAdapter>,
      +nodeCount: number,
      +edgeCount: number,
    |},
    +pnd: ?PagerankNodeDecomposition,
  |},
  edgeEvaluator: ?EdgeEvaluator,
};

const MAX_ENTRIES_PER_LIST = 100;

export class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      selectedRepo: null,
      data: {graphWithMetadata: null, pnd: null},
      edgeEvaluator: null,
    };
  }

  render() {
    const {localStore} = this.props;
    const {edgeEvaluator, selectedRepo} = this.state;
    const {graphWithMetadata, pnd} = this.state.data;
    return (
      <div style={{maxWidth: "66em", margin: "0 auto", padding: "0 10px"}}>
        <header className={css(styles.header)}>
          <h1>Cred Explorer</h1>
        </header>
        <div>
          <RepositorySelect
            localStore={localStore}
            onChange={(selectedRepo) => this.setState({selectedRepo})}
          />
          <br />
          <button
            disabled={selectedRepo == null}
            onClick={() => this.loadData()}
          >
            Load data
          </button>
          <button
            disabled={graphWithMetadata == null || edgeEvaluator == null}
            onClick={() => {
              if (graphWithMetadata == null || edgeEvaluator == null) {
                throw new Error("Unexpected null value");
              }
              const {graph} = graphWithMetadata;
              pagerank(graph, edgeEvaluator, {
                verbose: true,
              }).then((pnd) => {
                const data = {graphWithMetadata, pnd};
                // In case a new graph was loaded while waiting for
                // PageRank.
                const stomped =
                  this.state.data.graphWithMetadata &&
                  this.state.data.graphWithMetadata.graph !== graph;
                if (!stomped) {
                  this.setState({data});
                }
              });
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
          <WeightConfig
            localStore={localStore}
            onChange={(ee) => this.setState({edgeEvaluator: ee})}
          />
          <PagerankTable
            adapters={NullUtil.map(graphWithMetadata, (x) => x.adapters)}
            pnd={pnd}
            maxEntriesPerList={MAX_ENTRIES_PER_LIST}
          />
        </div>
      </div>
    );
  }

  loadData() {
    const {selectedRepo} = this.state;
    if (selectedRepo == null) {
      throw new Error(`Impossible`);
    }

    const githubPromise = new GithubAdapter()
      .load(selectedRepo)
      .then((adapter) => {
        const graph = adapter.graph();
        return {graph, adapter};
      });

    const gitPromise = new GitAdapter().load(selectedRepo).then((adapter) => {
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
        pnd: null,
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
