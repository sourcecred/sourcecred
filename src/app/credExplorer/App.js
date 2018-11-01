// @flow

import React from "react";

import type {Assets} from "../../webutil/assets";
import type {LocalStore} from "../../webutil/localStore";
import CheckedLocalStore from "../../webutil/checkedLocalStore";
import BrowserLocalStore from "../../webutil/browserLocalStore";
import Link from "../../webutil/Link";

import {defaultStaticAdapters} from "../adapters/defaultPlugins";
import {PagerankTable} from "./pagerankTable/Table";
import type {WeightedTypes} from "../../analysis/weights";
import {defaultWeightsForAdapterSet} from "./weights/weights";
import RepositorySelect from "./RepositorySelect";
import {Prefix as GithubPrefix} from "../../plugins/github/nodes";
import {
  createStateTransitionMachine,
  type AppState,
  type StateTransitionMachineInterface,
  uninitializedState,
} from "./state";
import {StaticAdapterSet} from "../adapters/adapterSet";

export default class AppPage extends React.Component<{|+assets: Assets|}> {
  static _LOCAL_STORE = new CheckedLocalStore(
    new BrowserLocalStore({
      version: "2",
      keyPrefix: "cred-explorer",
    })
  );

  render() {
    const App = createApp(createStateTransitionMachine);
    return (
      <App
        assets={this.props.assets}
        adapters={defaultStaticAdapters()}
        localStore={AppPage._LOCAL_STORE}
      />
    );
  }
}

type Props = {|
  +assets: Assets,
  +localStore: LocalStore,
  +adapters: StaticAdapterSet,
|};
type State = {|
  appState: AppState,
  weightedTypes: WeightedTypes,
|};

export function createApp(
  createSTM: (
    getState: () => AppState,
    setState: (AppState) => void
  ) => StateTransitionMachineInterface
) {
  return class App extends React.Component<Props, State> {
    stateTransitionMachine: StateTransitionMachineInterface;

    constructor(props: Props) {
      super(props);
      this.state = {
        appState: uninitializedState(),
        weightedTypes: defaultWeightsForAdapterSet(props.adapters),
      };
      this.stateTransitionMachine = createSTM(
        () => this.state.appState,
        (appState) => this.setState({appState})
      );
    }

    render() {
      const {localStore} = this.props;
      const {appState} = this.state;
      let pagerankTable;
      if (appState.type === "PAGERANK_EVALUATED") {
        const adapters = appState.graphWithAdapters.adapters;
        const pnd = appState.pagerankNodeDecomposition;
        pagerankTable = (
          <PagerankTable
            defaultNodeFilter={GithubPrefix.user}
            adapters={adapters}
            weightedTypes={this.state.weightedTypes}
            onWeightedTypesChange={(weightedTypes) =>
              this.setState({weightedTypes})
            }
            pnd={pnd}
            maxEntriesPerList={100}
          />
        );
      }
      const spacer = () => (
        <span style={{display: "inline-block", width: 12}} />
      );
      return (
        <div style={{maxWidth: 900, margin: "0 auto", padding: "0 10px"}}>
          <p style={{textAlign: "right"}}>
            <Link href="https://discuss.sourcecred.io/t/a-gentle-introduction-to-cred/20">
              what is this?
            </Link>
            {spacer()}
            <Link href={process.env.SOURCECRED_FEEDBACK_URL || ""}>
              feedback
            </Link>
          </p>
          <div style={{marginBottom: 10}}>
            <RepositorySelect
              assets={this.props.assets}
              localStore={localStore}
              onChange={(repoId) =>
                this.stateTransitionMachine.setRepoId(repoId)
              }
            />
          </div>
          <button
            disabled={
              appState.type === "UNINITIALIZED" ||
              appState.loading === "LOADING"
            }
            onClick={() =>
              this.stateTransitionMachine.loadGraphAndRunPagerank(
                this.props.assets,
                this.props.adapters,
                this.state.weightedTypes,
                GithubPrefix.user
              )
            }
          >
            Analyze cred
          </button>
          <LoadingIndicator appState={this.state.appState} />
          {pagerankTable}
        </div>
      );
    }
  };
}

export class LoadingIndicator extends React.PureComponent<{|
  +appState: AppState,
|}> {
  render() {
    return (
      <span style={{paddingLeft: 10}}>{loadingText(this.props.appState)}</span>
    );
  }
}

export function loadingText(state: AppState) {
  switch (state.type) {
    case "UNINITIALIZED": {
      return "Initializing...";
    }
    case "READY_TO_LOAD_GRAPH": {
      return {
        LOADING: "Loading graph...",
        NOT_LOADING: "Ready to load graph",
        FAILED: "Error while loading graph",
      }[state.loading];
    }
    case "READY_TO_RUN_PAGERANK": {
      return {
        LOADING: "Running PageRank...",
        NOT_LOADING: "Ready to run PageRank",
        FAILED: "Error while running PageRank",
      }[state.loading];
    }
    case "PAGERANK_EVALUATED": {
      return {
        LOADING: "Re-running PageRank...",
        NOT_LOADING: "",
        FAILED: "Error while running PageRank",
      }[state.loading];
    }
    default:
      throw new Error((state.type: empty));
  }
}
