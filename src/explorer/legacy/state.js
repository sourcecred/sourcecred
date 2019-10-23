// @flow

import deepEqual from "lodash.isequal";

import {Graph, type NodeAddressT} from "../../core/graph";
import type {Assets} from "../../webutil/assets";
import {type EdgeEvaluator} from "../../analysis/pagerank";
import type {NodeAndEdgeTypes} from "../../analysis/types";
import {defaultLoader} from "../TimelineApp";
import {
  type PagerankNodeDecomposition,
  type PagerankOptions,
  pagerank,
} from "../../analysis/pagerank";
import {TimelineCred} from "../../analysis/timeline/timelineCred";

import type {Weights} from "../../analysis/weights";
import {weightsToEdgeEvaluator} from "../../analysis/weightsToEdgeEvaluator";

/*
  This models the UI states of the credExplorer/App as a state machine.

  The different states are all instances of AppState, and the transitions are
  explicitly managed by the StateTransitionMachine class. All of the
  transitions, including error cases, are thoroughly tested.
 */

export type LoadingState = "NOT_LOADING" | "LOADING" | "FAILED";
export type AppState =
  | ReadyToLoadGraph
  | ReadyToRunPagerank
  | PagerankEvaluated;

export type ReadyToLoadGraph = {|
  +type: "READY_TO_LOAD_GRAPH",
  +projectId: string,
  +loading: LoadingState,
|};
export type ReadyToRunPagerank = {|
  +type: "READY_TO_RUN_PAGERANK",
  +projectId: string,
  +timelineCred: TimelineCred,
  +loading: LoadingState,
|};
export type PagerankEvaluated = {|
  +type: "PAGERANK_EVALUATED",
  +timelineCred: TimelineCred,
  +projectId: string,
  +pagerankNodeDecomposition: PagerankNodeDecomposition,
  +loading: LoadingState,
|};

export function initialState(projectId: string): ReadyToLoadGraph {
  return {type: "READY_TO_LOAD_GRAPH", projectId, loading: "NOT_LOADING"};
}

export function createStateTransitionMachine(
  getState: () => AppState,
  setState: (AppState) => void
): StateTransitionMachine {
  return new StateTransitionMachine(
    getState,
    setState,
    doLoadTimelineCred,
    pagerank
  );
}

// Exported for testing purposes.
export interface StateTransitionMachineInterface {
  +loadTimelineCred: (Assets) => Promise<boolean>;
  +runPagerank: (Weights, NodeAndEdgeTypes, NodeAddressT) => Promise<void>;
  +loadTimelineCredAndRunPagerank: (
    Assets,
    Weights,
    NodeAndEdgeTypes,
    NodeAddressT
  ) => Promise<void>;
}
/* In production, instantiate via createStateTransitionMachine; the constructor
 * implementation allows specification of the loadTimelineCred and
 * pagerank functions for DI/testing purposes.
 **/
export class StateTransitionMachine implements StateTransitionMachineInterface {
  getState: () => AppState;
  setState: (AppState) => void;
  doLoadTimelineCred: (
    assets: Assets,
    projectId: string
  ) => Promise<TimelineCred>;
  pagerank: (
    Graph,
    EdgeEvaluator,
    PagerankOptions
  ) => Promise<PagerankNodeDecomposition>;

  constructor(
    getState: () => AppState,
    setState: (AppState) => void,
    doLoadTimelineCred: (
      assets: Assets,
      projectId: string
    ) => Promise<TimelineCred>,
    pagerank: (
      Graph,
      EdgeEvaluator,
      PagerankOptions
    ) => Promise<PagerankNodeDecomposition>
  ) {
    this.getState = getState;
    this.setState = setState;
    this.doLoadTimelineCred = doLoadTimelineCred;
    this.pagerank = pagerank;
  }

  /** Loads the graph, reports whether it was successful */
  async loadTimelineCred(assets: Assets): Promise<boolean> {
    const state = this.getState();
    if (state.type !== "READY_TO_LOAD_GRAPH") {
      throw new Error("Tried to loadTimelineCred in incorrect state");
    }
    const {projectId} = state;
    const loadingState = {...state, loading: "LOADING"};
    this.setState(loadingState);
    let newState: ?AppState;
    let success = true;
    try {
      const timelineCred = await this.doLoadTimelineCred(assets, projectId);
      newState = {
        type: "READY_TO_RUN_PAGERANK",
        timelineCred,
        projectId,
        loading: "NOT_LOADING",
      };
    } catch (e) {
      console.error(e);
      newState = {...loadingState, loading: "FAILED"};
      success = false;
    }
    if (deepEqual(this.getState(), loadingState)) {
      this.setState(newState);
      return success;
    }
    return false;
  }

  async runPagerank(
    weights: Weights,
    types: NodeAndEdgeTypes,
    totalScoreNodePrefix: NodeAddressT
  ) {
    const state = this.getState();
    if (
      state.type !== "READY_TO_RUN_PAGERANK" &&
      state.type !== "PAGERANK_EVALUATED"
    ) {
      throw new Error("Tried to runPagerank in incorrect state");
    }
    // Flow hack :/
    const loadingState =
      state.type === "READY_TO_RUN_PAGERANK"
        ? {...state, loading: "LOADING"}
        : {...state, loading: "LOADING"};
    this.setState(loadingState);
    const graph = state.timelineCred.graph();
    let newState: ?AppState;
    try {
      const pagerankNodeDecomposition = await this.pagerank(
        graph,
        weightsToEdgeEvaluator(weights, types),
        {
          verbose: true,
          totalScoreNodePrefix: totalScoreNodePrefix,
        }
      );
      newState = {
        type: "PAGERANK_EVALUATED",
        pagerankNodeDecomposition,
        timelineCred: state.timelineCred,
        projectId: state.projectId,
        loading: "NOT_LOADING",
      };
    } catch (e) {
      console.error(e);
      // Flow hack :/
      newState =
        state.type === "READY_TO_RUN_PAGERANK"
          ? {...state, loading: "FAILED"}
          : {...state, loading: "FAILED"};
    }
    if (deepEqual(this.getState(), loadingState)) {
      this.setState(newState);
    }
  }

  async loadTimelineCredAndRunPagerank(
    assets: Assets,
    weights: Weights,
    types: NodeAndEdgeTypes,
    totalScoreNodePrefix: NodeAddressT
  ) {
    const state = this.getState();
    const type = state.type;
    switch (type) {
      case "READY_TO_LOAD_GRAPH":
        const loadedTimelineCred = await this.loadTimelineCred(assets);
        if (loadedTimelineCred) {
          await this.runPagerank(weights, types, totalScoreNodePrefix);
        }
        break;
      case "READY_TO_RUN_PAGERANK":
      case "PAGERANK_EVALUATED":
        await this.runPagerank(weights, types, totalScoreNodePrefix);
        break;
      default:
        throw new Error((type: empty));
    }
  }
}

export async function doLoadTimelineCred(
  assets: Assets,
  projectId: string
): Promise<TimelineCred> {
  const loadResult = await defaultLoader(assets, projectId);
  if (loadResult.type !== "SUCCESS") {
    throw new Error(loadResult);
  }
  return loadResult.timelineCred;
}
