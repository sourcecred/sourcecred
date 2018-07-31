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
    graphWithAdapters: ?{|
      +graph: Graph,
      +adapters: $ReadOnlyArray<DynamicPluginAdapter>,
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
      data: {graphWithAdapters: null, pnd: null},
      edgeEvaluator: null,
    };
  }

  render() {
    const {localStore} = this.props;
    const {edgeEvaluator, selectedRepo} = this.state;
    const {graphWithAdapters, pnd} = this.state.data;
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
            disabled={graphWithAdapters == null || edgeEvaluator == null}
            onClick={() => {
              if (graphWithAdapters == null || edgeEvaluator == null) {
                throw new Error("Unexpected null value");
              }
              const {graph} = graphWithAdapters;
              pagerank(graph, edgeEvaluator, {
                verbose: true,
              }).then((pnd) => {
                const data = {graphWithAdapters, pnd};
                // In case a new graph was loaded while waiting for
                // PageRank.
                const stomped =
                  this.state.data.graphWithAdapters &&
                  this.state.data.graphWithAdapters.graph !== graph;
                if (!stomped) {
                  this.setState({data});
                }
              });
            }}
          >
            Run basic PageRank
          </button>
          {graphWithAdapters ? <p>Graph loaded.</p> : <p>Graph not loaded.</p>}
          <WeightConfig
            localStore={localStore}
            onChange={(ee) => this.setState({edgeEvaluator: ee})}
          />
          <PagerankTable
            adapters={NullUtil.map(graphWithAdapters, (x) => x.adapters)}
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

    const statics = [new GithubAdapter(), new GitAdapter()];
    Promise.all(statics.map((a) => a.load(selectedRepo))).then((adapters) => {
      const graph = Graph.merge(adapters.map((x) => x.graph()));
      const data = {
        graphWithAdapters: {
          graph,
          adapters,
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
