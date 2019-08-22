// @flow

import React from "react";

import type {Assets} from "../../webutil/assets";
import type {LocalStore} from "../../webutil/localStore";
import CheckedLocalStore from "../../webutil/checkedLocalStore";
import BrowserLocalStore from "../../webutil/browserLocalStore";
import Link from "../../webutil/Link";
import {type NodeAddressT} from "../../core/graph";
import {declaration as githubDeclaration} from "../../plugins/github/declaration";

import {PagerankTable} from "./pagerankTable/Table";
import {WeightConfig} from "../weights/WeightConfig";
import {WeightsFileManager} from "../weights/WeightsFileManager";
import {type Weights, defaultWeights} from "../../analysis/weights";
import {Prefix as GithubPrefix} from "../../plugins/github/nodes";
import {
  createStateTransitionMachine,
  type AppState,
  type StateTransitionMachineInterface,
  initialState,
} from "./state";
import {userNodeType} from "../../plugins/github/declaration";

const credOverviewUrl =
  "https://discourse.sourcecred.io/t/a-gentle-introduction-to-cred/20";
const feedbackUrl =
  "https://docs.google.com/forms/d/e/1FAIpQLSdwxqFJNQIVS3EqISJ0EUcr1aixARDVA51DMURWSYgORFPHcQ/viewform";

export class AppPage extends React.Component<{|
  +assets: Assets,
  +projectId: string,
|}> {
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
        projectId={this.props.projectId}
        assets={this.props.assets}
        localStore={AppPage._LOCAL_STORE}
      />
    );
  }
}

type Props = {|
  +assets: Assets,
  +localStore: LocalStore,
  +projectId: string,
|};
type State = {|
  appState: AppState,
  weights: Weights,
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
        appState: initialState(this.props.projectId),
        weights: defaultWeights(),
      };
      this.stateTransitionMachine = createSTM(
        () => this.state.appState,
        (appState) => this.setState({appState})
      );
    }

    render() {
      const {appState} = this.state;
      const weightConfig = (
        <WeightConfig
          declarations={[githubDeclaration]}
          nodeTypeWeights={this.state.weights.nodeTypeWeights}
          edgeTypeWeights={this.state.weights.edgeTypeWeights}
          onNodeWeightChange={(prefix, weight) => {
            this.setState(({weights}) => {
              weights.nodeTypeWeights.set(prefix, weight);
              return {weights};
            });
          }}
          onEdgeWeightChange={(prefix, weight) => {
            this.setState(({weights}) => {
              weights.edgeTypeWeights.set(prefix, weight);
              return {weights};
            });
          }}
        />
      );
      const weightFileManager = (
        <WeightsFileManager
          weights={this.state.weights}
          onWeightsChange={(weights: Weights) => {
            this.setState({weights});
          }}
        />
      );
      let pagerankTable;
      if (appState.type === "PAGERANK_EVALUATED") {
        const pnd = appState.pagerankNodeDecomposition;
        pagerankTable = (
          <PagerankTable
            defaultNodeType={userNodeType}
            weightConfig={weightConfig}
            weightFileManager={weightFileManager}
            manualWeights={this.state.weights.nodeManualWeights}
            declarations={[githubDeclaration]}
            graph={appState.graph}
            onManualWeightsChange={(addr: NodeAddressT, weight: number) =>
              this.setState(({weights}) => {
                weights.nodeManualWeights.set(addr, weight);
                return {weights};
              })
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
            <Link href={credOverviewUrl}>what is this?</Link>
            {spacer()}
            <Link href={feedbackUrl}>feedback</Link>
          </p>
          <h2>SourceCred Legacy Mode</h2>
          <p>
            Back to{" "}
            <Link to={`/timeline/${this.props.projectId}/`}>timeline mode</Link>
          </p>

          <ProjectDetail projectId={this.props.projectId} />
          <button
            disabled={
              appState.type === "UNINITIALIZED" ||
              appState.loading === "LOADING"
            }
            onClick={() =>
              this.stateTransitionMachine.loadGraphAndRunPagerank(
                this.props.assets,
                this.state.weights,
                {
                  nodeTypes: githubDeclaration.nodeTypes.slice(),
                  edgeTypes: githubDeclaration.edgeTypes.slice(),
                },
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

export class ProjectDetail extends React.PureComponent<{|
  +projectId: string,
|}> {
  render() {
    return <p>{this.props.projectId}</p>;
  }
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
