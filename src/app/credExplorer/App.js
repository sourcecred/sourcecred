// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";
import sortBy from "lodash.sortby";
import deepEqual from "lodash.isequal";
import { Button, Dropdown } from 'semantic-ui-react'

import LocalStore from "./LocalStore";
import {StaticPluginAdapter as GithubAdapter} from "../../plugins/github/pluginAdapter";
import {StaticPluginAdapter as GitAdapter} from "../../plugins/git/pluginAdapter";
import {Graph} from "../../core/graph";
import {pagerank} from "../../core/attribution/pagerank";
import {PagerankTable} from "./PagerankTable";
import type {DynamicPluginAdapter} from "../pluginAdapter";
import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {WeightConfig} from "./WeightConfig";
import type {PagerankNodeDecomposition} from "../../core/attribution/pagerankNodeDecomposition";
import styles from '../style/styles';
import * as NullUtil from "../../util/null";

type Repo = {name: string, owner: string};
type Props = {||};
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
const REPO_REGISTRY_API = "/api/v1/data/repositoryRegistry.json";
const REPO_KEY = "selectedRepository";

function validateRepo(repo: Repo) {
  const validRe = /^[A-Za-z0-9_-]+$/;
  if (!repo.owner.match(validRe)) {
    throw new Error(`Invalid repository owner: ${JSON.stringify(repo.owner)}`);
  }
  if (!repo.name.match(validRe)) {
    throw new Error(`Invalid repository name: ${JSON.stringify(repo.name)}`);
  }
}

function repoStringToRepo(x: string): Repo {
  const pieces = x.split("/");
  if (pieces.length !== 2) {
    throw new Error(`Invalid repo string: ${x}`);
  }

  const repo = {owner: pieces[0], name: pieces[1]};
  validateRepo(repo);
  return repo;
}

type RepositorySelectorProps = {|+onChange: (x: ?Repo) => void|};
type RepositorySelectorState = {|
  selectedRepo: ?Repo,
  availableRepos: ?$ReadOnlyArray<Repo>,
  errorOnLoad: boolean,
|};
export class RepositorySelector extends React.Component<
  RepositorySelectorProps,
  RepositorySelectorState
> {
  constructor(props: RepositorySelectorProps) {
    super(props);
    this.state = {
      selectedRepo: null,
      availableRepos: null,
      errorOnLoad: false,
    };
  }

  componentDidMount() {
    this.loadAvailableRepos();
  }

  async loadAvailableRepos() {
    const response = await fetch(REPO_REGISTRY_API);
    if (!response || !response.ok) {
      this.setState({errorOnLoad: true});
      return;
    }
    const json = await response.json();
    let availableRepos = Object.keys(json).map(repoStringToRepo);
    availableRepos = sortBy(availableRepos, (r) => r.owner, (r) => r.name);

    let selectedRepo;
    const localStoreRepo = LocalStore.get(REPO_KEY, null);
    if (availableRepos.find((x) => deepEqual(x, localStoreRepo)) !== -1) {
      selectedRepo = localStoreRepo;
    }
    if (availableRepos.length > 0 && selectedRepo == null) {
      selectedRepo = availableRepos[0];
    }
    this.setState({availableRepos, selectedRepo});
    this.props.onChange(selectedRepo);
  }

  render() {
    const {selectedRepo, availableRepos, errorOnLoad} = this.state;
    if (errorOnLoad) {
      return <span>{"Error loading available repos"}</span>;
    }
    if (availableRepos == null) {
      return <span>{"Waiting to load available repos"}</span>;
    }
    if (availableRepos.length === 0) {
      return (
        <span>
          {"No repos are available. Please see the README for instructions."}
        </span>
      );
    }
    if (selectedRepo == null) {
      throw new Error(
        "Error: expected selectedRepo to be set when availbaleRepos are present"
      );
    }
    const options = availableRepos.map(({owner, name}) => {
      const repoString = `${owner}/${name}`;
      return { text: repoString, key: repoString, value: repoString };
    });
    return (
      <label>
        <span>Please choose a repository to inspect:</span>
        <Dropdown
          selection
          value={`${selectedRepo.owner}/${selectedRepo.name}`}
          onChange={(e) => {
            const repoString = e.target.value;
            const repo = repoStringToRepo(repoString);
            LocalStore.set(REPO_KEY, repo);
            this.setState({selectedRepo: repo});
            this.props.onChange(repo);
          }}
          options={options}
        />
      </label>
    );
  }
}

export default class App extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      selectedRepo: null,
      data: {graphWithMetadata: null, pnd: null},
      edgeEvaluator: null,
    };
  }

  render() {
    const {edgeEvaluator, selectedRepo} = this.state;
    const {graphWithMetadata, pnd} = this.state.data;
    return (
      <div className={css(style.body)}>
        <h1 className={css(style.header)}>Cred Explorer</h1>
        <div>
          <RepositorySelector
            onChange={(selectedRepo) => this.setState({selectedRepo})}
          />
          <br />
          <Button
            basic
            color="teal"
            disabled={selectedRepo == null}
            onClick={() => this.loadData()}
          >
            Load data
          </Button>
          <Button
            basic
            color="teal"
            disabled={graphWithMetadata == null || edgeEvaluator == null}
            onClick={() => {
              setTimeout(() => {
                if (graphWithMetadata == null || edgeEvaluator == null) {
                  throw new Error("Unexpected null value");
                }
                const {graph} = graphWithMetadata;
                const pnd = pagerank(graph, edgeEvaluator, {
                  verbose: true,
                });
                const data = {graphWithMetadata, pnd};
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
          </Button>
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
      .load(selectedRepo.owner, selectedRepo.name)
      .then((adapter) => {
        const graph = adapter.graph();
        return {graph, adapter};
      });

    const gitPromise = new GitAdapter()
      .load(selectedRepo.owner, selectedRepo.name)
      .then((adapter) => {
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

const style = StyleSheet.create(styles);
