// @flow

import deepEqual from "lodash.isequal";

import {Graph, type NodeAddressT} from "../core/graph";
import type {Assets} from "../webutil/assets";
import type {RepoId} from "../core/repoId";
import {type EdgeEvaluator} from "../analysis/pagerank";
import {
  type PagerankNodeDecomposition,
  type PagerankOptions,
  pagerank,
} from "../analysis/pagerank";

import {
  StaticExplorerAdapterSet,
  DynamicExplorerAdapterSet,
} from "./adapters/explorerAdapterSet";
import type {WeightedTypes} from "../analysis/weights";
import {weightsToEdgeEvaluator} from "../analysis/weightsToEdgeEvaluator";

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
  +repoId: RepoId,
  +loading: LoadingState,
|};
export type ReadyToRunPagerank = {|
  +type: "READY_TO_RUN_PAGERANK",
  +repoId: RepoId,
  +graphWithAdapters: GraphWithAdapters,
  +loading: LoadingState,
|};
export type PagerankEvaluated = {|
  +type: "PAGERANK_EVALUATED",
  +graphWithAdapters: GraphWithAdapters,
  +repoId: RepoId,
  +pagerankNodeDecomposition: PagerankNodeDecomposition,
  +loading: LoadingState,
|};

type ManualWeights = Map<NodeAddressT, number>;

export function initialState(repoId: RepoId): ReadyToLoadGraph {
  return {type: "READY_TO_LOAD_GRAPH", repoId, loading: "NOT_LOADING"};
}

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

// Exported for testing purposes.
export interface StateTransitionMachineInterface {
  +loadGraph: (Assets, StaticExplorerAdapterSet) => Promise<boolean>;
  +runPagerank: (WeightedTypes, ManualWeights, NodeAddressT) => Promise<void>;
  +loadGraphAndRunPagerank: (
    Assets,
    StaticExplorerAdapterSet,
    WeightedTypes,
    ManualWeights,
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
    adapters: StaticExplorerAdapterSet,
    repoId: RepoId
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
      adapters: StaticExplorerAdapterSet,
      repoId: RepoId
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

  /** Loads the graph, reports whether it was successful */
  async loadGraph(
    assets: Assets,
    adapters: StaticExplorerAdapterSet
  ): Promise<boolean> {
    const state = this.getState();
    if (state.type !== "READY_TO_LOAD_GRAPH") {
      throw new Error("Tried to loadGraph in incorrect state");
    }
    const {repoId} = state;
    const loadingState = {...state, loading: "LOADING"};
    this.setState(loadingState);
    let newState: ?AppState;
    let success = true;
    try {
      const graphWithAdapters = await this.loadGraphWithAdapters(
        assets,
        adapters,
        repoId
      );
      newState = {
        type: "READY_TO_RUN_PAGERANK",
        graphWithAdapters,
        repoId,
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
    weightedTypes: WeightedTypes,
    manualWeights: ManualWeights,
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
        weightsToEdgeEvaluator(weightedTypes, manualWeights),
        {
          verbose: true,
          totalScoreNodePrefix: totalScoreNodePrefix,
        }
      );
      newState = {
        type: "PAGERANK_EVALUATED",
        pagerankNodeDecomposition,
        graphWithAdapters: state.graphWithAdapters,
        repoId: state.repoId,
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
    adapters: StaticExplorerAdapterSet,
    weightedTypes: WeightedTypes,
    manualWeights: ManualWeights,
    totalScoreNodePrefix: NodeAddressT
  ) {
    const state = this.getState();
    const type = state.type;
    switch (type) {
      case "READY_TO_LOAD_GRAPH":
        const loadedGraph = await this.loadGraph(assets, adapters);
        if (loadedGraph) {
          await this.runPagerank(
            weightedTypes,
            manualWeights,
            totalScoreNodePrefix
          );
        }
        break;
      case "READY_TO_RUN_PAGERANK":
      case "PAGERANK_EVALUATED":
        await this.runPagerank(
          weightedTypes,
          manualWeights,
          totalScoreNodePrefix
        );
        break;
      default:
        throw new Error((type: empty));
    }
  }
}

export type GraphWithAdapters = {|
  +graph: Graph,
  +adapters: DynamicExplorerAdapterSet,
|};
export async function loadGraphWithAdapters(
  assets: Assets,
  adapters: StaticExplorerAdapterSet,
  repoId: RepoId
): Promise<GraphWithAdapters> {
  const dynamicAdapters = await adapters.load(assets, repoId);
  return {graph: dynamicAdapters.graph(), adapters: dynamicAdapters};
}
