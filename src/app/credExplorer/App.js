// @flow

import React from "react";

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

export default class AppPage extends React.Component<{||}> {
  static _LOCAL_STORE = new CheckedLocalStore(
    new BrowserLocalStore({
      version: "2",
      keyPrefix: "cred-explorer",
    })
  );

  render() {
    const App = createApp(createStateTransitionMachine);
    return <App localStore={AppPage._LOCAL_STORE} />;
  }
}

type Props = {|+localStore: LocalStore|};
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
      const subType =
        appState.type === "INITIALIZED" ? appState.substate.type : null;
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
            defaultNodeFilter={GithubPrefix.userlike}
            adapters={adapters}
            pnd={pnd}
            maxEntriesPerList={100}
          />
        );
      }
      return (
        <div style={{maxWidth: 900, margin: "0 auto", padding: "0 10px"}}>
          <div style={{marginBottom: 10}}>
            <RepositorySelect
              localStore={localStore}
              onChange={(repo) => this.stateTransitionMachine.setRepo(repo)}
            />
          </div>
          <button
            disabled={subType !== "READY_TO_LOAD_GRAPH"}
            onClick={() => this.stateTransitionMachine.loadGraph()}
          >
            Load graph
          </button>
          <button
            disabled={
              !(
                (subType === "READY_TO_RUN_PAGERANK" ||
                  subType === "PAGERANK_EVALUATED") &&
                loadingState !== "LOADING"
              )
            }
            onClick={() => this.stateTransitionMachine.runPagerank()}
          >
            Run PageRank
          </button>
          <WeightConfig
            localStore={localStore}
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
