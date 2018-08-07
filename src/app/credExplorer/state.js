// @flow

import deepEqual from "lodash.isequal";

import * as NullUtil from "../../util/null";
import {Graph} from "../../core/graph";
import type {Repo} from "../../core/repo";
import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {
  type PagerankNodeDecomposition,
  type PagerankOptions,
  pagerank,
} from "../../core/attribution/pagerank";

import type {DynamicPluginAdapter} from "../pluginAdapter";

import {defaultStaticAdapters} from "../defaultPlugins";

/*
  This models the UI states of the credExplorer/App as a state machine.

  The different states are all instances of AppState, and the transitions are
  explicitly managed by the StateTransitionMachine class. All of the
  transitions, including error cases, are thoroughly tested.
 */

export type AppState = Uninitialized | Initialized;
export type Uninitialized = {|
  +type: "UNINITIALIZED",
  edgeEvaluator: ?EdgeEvaluator,
  repo: ?Repo,
|};
export type Initialized = {|
  +type: "INITIALIZED",
  +edgeEvaluator: EdgeEvaluator,
  +repo: Repo,
  +substate: AppSubstate,
|};

export type LoadingState = "NOT_LOADING" | "LOADING" | "FAILED";
export type AppSubstate =
  | ReadyToLoadGraph
  | ReadyToRunPagerank
  | PagerankEvaluated;
export type ReadyToLoadGraph = {|
  +type: "READY_TO_LOAD_GRAPH",
  +loading: LoadingState,
|};
export type ReadyToRunPagerank = {|
  +type: "READY_TO_RUN_PAGERANK",
  +graphWithAdapters: GraphWithAdapters,
  +loading: LoadingState,
|};
export type PagerankEvaluated = {|
  +type: "PAGERANK_EVALUATED",
  +graphWithAdapters: GraphWithAdapters,
  pagerankNodeDecomposition: PagerankNodeDecomposition,
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

export function initialState(): AppState {
  return {type: "UNINITIALIZED", repo: null, edgeEvaluator: null};
}

// Exported for testing purposes.
export interface StateTransitionMachineInterface {
  +setRepo: (Repo) => void;
  +setEdgeEvaluator: (EdgeEvaluator) => void;
  +loadGraph: () => Promise<void>;
  +runPagerank: () => Promise<void>;
}
/* In production, instantiate via createStateTransitionMachine; the constructor
 * implementation allows specification of the loadGraphWithAdapters and
 * pagerank functions for DI/testing purposes.
 **/
export class StateTransitionMachine implements StateTransitionMachineInterface {
  getState: () => AppState;
  setState: (AppState) => void;
  loadGraphWithAdapters: (repo: Repo) => Promise<GraphWithAdapters>;
  pagerank: (
    Graph,
    EdgeEvaluator,
    PagerankOptions
  ) => Promise<PagerankNodeDecomposition>;

  constructor(
    getState: () => AppState,
    setState: (AppState) => void,
    loadGraphWithAdapters: (repo: Repo) => Promise<GraphWithAdapters>,
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

  _maybeInitialize(state: Uninitialized): AppState {
    const {repo, edgeEvaluator} = state;
    if (repo != null && edgeEvaluator != null) {
      const substate = {type: "READY_TO_LOAD_GRAPH", loading: "NOT_LOADING"};
      return {type: "INITIALIZED", repo, edgeEvaluator, substate};
    } else {
      return state;
    }
  }

  setRepo(repo: Repo) {
    const state = this.getState();
    switch (state.type) {
      case "UNINITIALIZED": {
        const newState = this._maybeInitialize({...state, repo});
        this.setState(newState);
        break;
      }
      case "INITIALIZED": {
        const substate = {type: "READY_TO_LOAD_GRAPH", loading: "NOT_LOADING"};
        const newState = {...state, repo, substate};
        this.setState(newState);
        break;
      }
      default: {
        throw new Error((state.type: empty));
      }
    }
  }

  setEdgeEvaluator(edgeEvaluator: EdgeEvaluator) {
    const state = this.getState();
    switch (state.type) {
      case "UNINITIALIZED": {
        const newState = this._maybeInitialize({...state, edgeEvaluator});
        this.setState(newState);
        break;
      }
      case "INITIALIZED": {
        const newState = {...state, edgeEvaluator};
        this.setState(newState);
        break;
      }
      default: {
        throw new Error((state.type: empty));
      }
    }
  }

  async loadGraph() {
    const state = this.getState();
    if (
      state.type !== "INITIALIZED" ||
      state.substate.type !== "READY_TO_LOAD_GRAPH"
    ) {
      throw new Error("Tried to loadGraph in incorrect state");
    }
    const {repo, substate} = state;
    const loadingState = {
      ...state,
      substate: {...substate, loading: "LOADING"},
    };
    this.setState(loadingState);
    let newState: ?AppState;
    try {
      const graphWithAdapters = await this.loadGraphWithAdapters(repo);
      newState = {
        ...state,
        substate: {
          type: "READY_TO_RUN_PAGERANK",
          graphWithAdapters,
          loading: "NOT_LOADING",
        },
      };
    } catch (e) {
      console.error(e);
      newState = {...state, substate: {...substate, loading: "FAILED"}};
    }
    if (deepEqual(this.getState(), loadingState)) {
      this.setState(newState);
    }
  }

  async runPagerank() {
    const state = this.getState();
    if (
      state.type !== "INITIALIZED" ||
      state.substate.type === "READY_TO_LOAD_GRAPH"
    ) {
      throw new Error("Tried to runPagerank in incorrect state");
    }
    const {edgeEvaluator, substate} = state;
    // Oh, the things we must do to appease flow
    const loadingSubstate =
      substate.type === "PAGERANK_EVALUATED"
        ? {...substate, loading: "LOADING"}
        : {...substate, loading: "LOADING"};
    const loadingState = {
      ...state,
      substate: loadingSubstate,
    };
    this.setState(loadingState);
    const graph = substate.graphWithAdapters.graph;
    let newState: ?AppState;
    try {
      const pagerankNodeDecomposition = await this.pagerank(
        graph,
        edgeEvaluator,
        {
          verbose: true,
        }
      );
      const newSubstate = {
        type: "PAGERANK_EVALUATED",
        graphWithAdapters: substate.graphWithAdapters,
        pagerankNodeDecomposition,
        loading: "NOT_LOADING",
      };
      newState = {...state, substate: newSubstate};
    } catch (e) {
      console.error(e);
      const failedSubstate =
        // More flow appeasement
        substate.type === "PAGERANK_EVALUATED"
          ? {...substate, loading: "FAILED"}
          : {...substate, loading: "FAILED"};
      newState = {...state, substate: failedSubstate};
    }
    if (deepEqual(this.getState(), loadingState)) {
      this.setState(NullUtil.get(newState));
    }
  }
}

export type GraphWithAdapters = {|
  +graph: Graph,
  +adapters: $ReadOnlyArray<DynamicPluginAdapter>,
|};
export function loadGraphWithAdapters(repo: Repo): Promise<GraphWithAdapters> {
  const statics = defaultStaticAdapters();
  return Promise.all(statics.map((a) => a.load(repo))).then((adapters) => {
    const graph = Graph.merge(adapters.map((x) => x.graph()));
    return {graph, adapters};
  });
}
