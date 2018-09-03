// @flow

import React from "react";

import type {Assets} from "../assets";
import type {LocalStore} from "../localStore";
import CheckedLocalStore from "../checkedLocalStore";
import BrowserLocalStore from "../browserLocalStore";

import {PagerankTable} from "./pagerankTable/Table";
import {WeightConfig} from "./WeightConfig";
import RepositorySelect from "./RepositorySelect";
import {_Prefix as GithubPrefix} from "../../plugins/github/nodes";
import {
  createStateTransitionMachine,
  type AppState,
  type StateTransitionMachineInterface,
  initialState,
} from "./state";

export default class AppPage extends React.Component<{|+assets: Assets|}> {
  static _LOCAL_STORE = new CheckedLocalStore(
    new BrowserLocalStore({
      version: "2",
      keyPrefix: "cred-explorer",
    })
  );

  render() {
    const App = createApp(createStateTransitionMachine);
    return <App assets={this.props.assets} localStore={AppPage._LOCAL_STORE} />;
  }
}

type Props = {|+assets: Assets, +localStore: LocalStore|};
type State = {|
  appState: AppState,
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
        appState: initialState(),
      };
      this.stateTransitionMachine = createSTM(
        () => this.state.appState,
        (appState) => this.setState({appState})
      );
    }

    render() {
      const {localStore} = this.props;
      const {appState} = this.state;
      const loadingState =
        appState.type === "INITIALIZED" ? appState.substate.loading : null;
      let pagerankTable;
      if (
        appState.type === "INITIALIZED" &&
        appState.substate.type === "PAGERANK_EVALUATED"
      ) {
        const adapters = appState.substate.graphWithAdapters.adapters;
        const pnd = appState.substate.pagerankNodeDecomposition;
        pagerankTable = (
          <PagerankTable
            defaultNodeFilter={GithubPrefix.user}
            adapters={adapters}
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
            <a
              href={
                "https://discuss.sourcecred.io/t/a-gentle-introduction-to-cred/20"
              }
            >
              what is this?
            </a>
            {spacer()}
            <a href={process.env.SOURCECRED_FEEDBACK_URL}>feedback</a>
          </p>
          <div style={{marginBottom: 10}}>
            <RepositorySelect
              assets={this.props.assets}
              localStore={localStore}
              onChange={(repo) => this.stateTransitionMachine.setRepo(repo)}
            />
          </div>
          <button
            disabled={
              appState.type === "UNINITIALIZED" || loadingState === "LOADING"
            }
            onClick={() =>
              this.stateTransitionMachine.loadGraphAndRunPagerank(
                this.props.assets,
                GithubPrefix.user
              )
            }
          >
            Analyze cred
          </button>
          <WeightConfig
            onChange={(ee) => this.stateTransitionMachine.setEdgeEvaluator(ee)}
          />
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
    case "INITIALIZED": {
      switch (state.substate.type) {
        case "READY_TO_LOAD_GRAPH": {
          return {
            LOADING: "Loading graph...",
            NOT_LOADING: "Ready to load graph",
            FAILED: "Error while loading graph",
          }[state.substate.loading];
        }
        case "READY_TO_RUN_PAGERANK": {
          return {
            LOADING: "Running PageRank...",
            NOT_LOADING: "Ready to run PageRank",
            FAILED: "Error while running PageRank",
          }[state.substate.loading];
        }
        case "PAGERANK_EVALUATED": {
          return {
            LOADING: "Re-running PageRank...",
            NOT_LOADING: "",
            FAILED: "Error while running PageRank",
          }[state.substate.loading];
        }
        default:
          throw new Error((state.substate.type: empty));
      }
    }
    default:
      throw new Error((state.type: empty));
  }
}
