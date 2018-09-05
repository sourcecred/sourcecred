// @flow

import deepEqual from "lodash.isequal";

import {Graph, type NodeAddressT} from "../../core/graph";
import type {Assets} from "../../app/assets";
import type {Repo} from "../../core/repo";
import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {
  type PagerankNodeDecomposition,
  type PagerankOptions,
  pagerank,
} from "../../core/attribution/pagerank";

import {StaticAdapterSet, DynamicAdapterSet} from "../adapters/adapterSet";

/*
  This models the UI states of the credExplorer/App as a state machine.

  The different states are all instances of AppState, and the transitions are
  explicitly managed by the StateTransitionMachine class. All of the
  transitions, including error cases, are thoroughly tested.
 */

export type LoadingState = "NOT_LOADING" | "LOADING" | "FAILED";
export type AppState =
  | Uninitialized
  | ReadyToLoadGraph
  | ReadyToRunPagerank
  | PagerankEvaluated;

export type Uninitialized = {|
  +type: "UNINITIALIZED",
|};
export type ReadyToLoadGraph = {|
  +type: "READY_TO_LOAD_GRAPH",
  +repo: Repo,
  +loading: LoadingState,
|};
export type ReadyToRunPagerank = {|
  +type: "READY_TO_RUN_PAGERANK",
  +repo: Repo,
  +graphWithAdapters: GraphWithAdapters,
  +loading: LoadingState,
|};
export type PagerankEvaluated = {|
  +type: "PAGERANK_EVALUATED",
  +graphWithAdapters: GraphWithAdapters,
  +repo: Repo,
  +pagerankNodeDecomposition: PagerankNodeDecomposition,
  +loading: LoadingState,
|};

export function createStateTransitionMachine(
  getState: () => AppState,
  setState: (AppState) => void
): StateTransitionMachine {
  return new StateTransitionMachine(
    getState,
    setState,
    loadGraphWithAdapters,
    pagerank
  );
}

export function uninitializedState(): AppState {
  return {type: "UNINITIALIZED"};
}

// Exported for testing purposes.
export interface StateTransitionMachineInterface {
  +setRepo: (Repo) => void;
  +loadGraph: (Assets, StaticAdapterSet) => Promise<boolean>;
  +runPagerank: (EdgeEvaluator, NodeAddressT) => Promise<void>;
  +loadGraphAndRunPagerank: (
    Assets,
    StaticAdapterSet,
    EdgeEvaluator,
    NodeAddressT
  ) => Promise<void>;
}
/* In production, instantiate via createStateTransitionMachine; the constructor
 * implementation allows specification of the loadGraphWithAdapters and
 * pagerank functions for DI/testing purposes.
 **/
export class StateTransitionMachine implements StateTransitionMachineInterface {
  getState: () => AppState;
  setState: (AppState) => void;
  loadGraphWithAdapters: (
    assets: Assets,
    adapters: StaticAdapterSet,
    repo: Repo
  ) => Promise<GraphWithAdapters>;
  pagerank: (
    Graph,
    EdgeEvaluator,
    PagerankOptions
  ) => Promise<PagerankNodeDecomposition>;

  constructor(
    getState: () => AppState,
    setState: (AppState) => void,
    loadGraphWithAdapters: (
      assets: Assets,
      adapters: StaticAdapterSet,
      repo: Repo
    ) => Promise<GraphWithAdapters>,
    pagerank: (
      Graph,
      EdgeEvaluator,
      PagerankOptions
    ) => Promise<PagerankNodeDecomposition>
  ) {
    this.getState = getState;
    this.setState = setState;
    this.loadGraphWithAdapters = loadGraphWithAdapters;
    this.pagerank = pagerank;
  }

  setRepo(repo: Repo) {
    const newState: AppState = {
      type: "READY_TO_LOAD_GRAPH",
      repo: repo,
      loading: "NOT_LOADING",
    };
    this.setState(newState);
  }

  /** Loads the graph, reports whether it was successful */
  async loadGraph(
    assets: Assets,
    adapters: StaticAdapterSet
  ): Promise<boolean> {
    const state = this.getState();
    if (state.type !== "READY_TO_LOAD_GRAPH") {
      throw new Error("Tried to loadGraph in incorrect state");
    }
    const {repo} = state;
    const loadingState = {...state, loading: "LOADING"};
    this.setState(loadingState);
    let newState: ?AppState;
    let success = true;
    try {
      const graphWithAdapters = await this.loadGraphWithAdapters(
        assets,
        adapters,
        repo
      );
      newState = {
        type: "READY_TO_RUN_PAGERANK",
        graphWithAdapters,
        repo,
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
    edgeEvaluator: EdgeEvaluator,
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
    const graph = state.graphWithAdapters.graph;
    let newState: ?AppState;
    try {
      const pagerankNodeDecomposition = await this.pagerank(
        graph,
        edgeEvaluator,
        {
          verbose: true,
          totalScoreNodePrefix: totalScoreNodePrefix,
        }
      );
      newState = {
        type: "PAGERANK_EVALUATED",
        pagerankNodeDecomposition,
        graphWithAdapters: state.graphWithAdapters,
        repo: state.repo,
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

  async loadGraphAndRunPagerank(
    assets: Assets,
    adapters: StaticAdapterSet,
    edgeEvaluator: EdgeEvaluator,
    totalScoreNodePrefix: NodeAddressT
  ) {
    const state = this.getState();
    const type = state.type;
    if (type === "UNINITIALIZED") {
      throw new Error("Tried to load and run from incorrect state");
    }
    switch (type) {
      case "READY_TO_LOAD_GRAPH":
        const loadedGraph = await this.loadGraph(assets, adapters);
        if (loadedGraph) {
          await this.runPagerank(edgeEvaluator, totalScoreNodePrefix);
        }
        break;
      case "READY_TO_RUN_PAGERANK":
      case "PAGERANK_EVALUATED":
        await this.runPagerank(edgeEvaluator, totalScoreNodePrefix);
        break;
      default:
        throw new Error((type: empty));
    }
  }
}

export type GraphWithAdapters = {|
  +graph: Graph,
  +adapters: DynamicAdapterSet,
|};
export async function loadGraphWithAdapters(
  assets: Assets,
  adapters: StaticAdapterSet,
  repo: Repo
): Promise<GraphWithAdapters> {
  const dynamicAdapters = await adapters.load(assets, repo);
  return {graph: dynamicAdapters.graph(), adapters: dynamicAdapters};
}
