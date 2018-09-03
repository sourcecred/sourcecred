// @flow

import {
  StateTransitionMachine,
  initialState,
  type AppState,
  type GraphWithAdapters,
} from "./state";

import {Graph, NodeAddress} from "../../core/graph";
import {Assets} from "../assets";
import {makeRepo, type Repo} from "../../core/repo";
import {type EdgeEvaluator} from "../../core/attribution/pagerank";
import {StaticAdapterSet, DynamicAdapterSet} from "../adapters/adapterSet";
import type {
  PagerankNodeDecomposition,
  PagerankOptions,
} from "../../core/attribution/pagerank";

describe("app/credExplorer/state", () => {
  function example(startingState: AppState) {
    const stateContainer = {appState: startingState};
    const getState = () => stateContainer.appState;
    const setState = (appState) => {
      stateContainer.appState = appState;
    };
    const loadGraphMock: (
      assets: Assets,
      repo: Repo
    ) => Promise<GraphWithAdapters> = jest.fn();
    const pagerankMock: (
      Graph,
      EdgeEvaluator,
      PagerankOptions
    ) => Promise<PagerankNodeDecomposition> = jest.fn();
    const stm = new StateTransitionMachine(
      getState,
      setState,
      loadGraphMock,
      pagerankMock
    );
    return {getState, stm, loadGraphMock, pagerankMock};
  }
  function initialized(substate): AppState {
    return {
      type: "INITIALIZED",
      repo: makeRepo("foo", "bar"),
      edgeEvaluator: edgeEvaluator(),
      substate,
    };
  }
  function readyToLoadGraph(): AppState {
    return initialized({type: "READY_TO_LOAD_GRAPH", loading: "NOT_LOADING"});
  }
  function readyToRunPagerank(): AppState {
    return initialized({
      type: "READY_TO_RUN_PAGERANK",
      loading: "NOT_LOADING",
      graphWithAdapters: graphWithAdapters(),
    });
  }
  function pagerankEvaluated(): AppState {
    return initialized({
      type: "PAGERANK_EVALUATED",
      graphWithAdapters: graphWithAdapters(),
      pagerankNodeDecomposition: pagerankNodeDecomposition(),
      loading: "NOT_LOADING",
    });
  }
  function edgeEvaluator(): EdgeEvaluator {
    return (_unused_Edge) => ({toWeight: 3, froWeight: 4});
  }
  function graphWithAdapters(): GraphWithAdapters {
    return {
      graph: new Graph(),
      adapters: new DynamicAdapterSet(new StaticAdapterSet([]), []),
    };
  }
  function pagerankNodeDecomposition() {
    return new Map();
  }
  function getSubstate(state: AppState) {
    if (state.type !== "INITIALIZED") {
      throw new Error("Tried to get invalid substate");
    }
    return state.substate;
  }
  function loading(state: AppState) {
    if (
      state.type !== "INITIALIZED" ||
      state.substate.type === "PAGERANK_EVALUATED"
    ) {
      throw new Error("Tried to get invalid loading");
    }
    return state.substate.loading;
  }

  describe("setRepo", () => {
    describe("in UNINITIALIZED", () => {
      it("stays UNINITIALIZED if edge evaluator not set", () => {
        const {getState, stm} = example(initialState());
        const repo = makeRepo("foo", "bar");
        stm.setRepo(repo);
        const state = getState();
        expect(state.type).toBe("UNINITIALIZED");
        expect(state.repo).toEqual(repo);
      });
      it("transitions to INITIALIZED if an edge evaluator was set", () => {
        const {getState, stm} = example(initialState());
        stm.setEdgeEvaluator(edgeEvaluator());
        const repo = makeRepo("foo", "bar");
        stm.setRepo(repo);
        const state = getState();
        expect(state.type).toBe("INITIALIZED");
        expect(state.repo).toEqual(repo);
      });
    });
    describe("in INITIALIZED", () => {
      it("stays in READY_TO_LOAD_GRAPH with new repo", () => {
        const {getState, stm} = example(readyToLoadGraph());
        const repo = makeRepo("zoink", "zod");
        stm.setRepo(repo);
        const state = getState();
        expect(getSubstate(state).type).toBe("READY_TO_LOAD_GRAPH");
        expect(state.repo).toEqual(repo);
      });
      it("transitions READY_TO_RUN_PAGERANK to READY_TO_LOAD_GRAPH with new repo", () => {
        const {getState, stm} = example(readyToRunPagerank());
        const repo = makeRepo("zoink", "zod");
        stm.setRepo(repo);
        const state = getState();
        expect(getSubstate(state).type).toBe("READY_TO_LOAD_GRAPH");
        expect(state.repo).toEqual(repo);
      });
      it("transitions PAGERANK_EVALUATED to READY_TO_LOAD_GRAPH with new repo", () => {
        const {getState, stm} = example(pagerankEvaluated());
        const repo = makeRepo("zoink", "zod");
        stm.setRepo(repo);
        const state = getState();
        expect(getSubstate(state).type).toBe("READY_TO_LOAD_GRAPH");
        expect(state.repo).toEqual(repo);
      });
    });
  });

  describe("setEdgeEvaluator", () => {
    describe("in UNINITIALIZED", () => {
      it("sets ee without transitioning to INITIALIZE if repo not set", () => {
        const {getState, stm} = example(initialState());
        const ee = edgeEvaluator();
        stm.setEdgeEvaluator(ee);
        const state = getState();
        expect(state.type).toBe("UNINITIALIZED");
        expect(state.edgeEvaluator).toBe(ee);
      });
      it("triggers transition to INITIALIZED if repo was set", () => {
        const {getState, stm} = example(initialState());
        stm.setRepo(makeRepo("foo", "zod"));
        const ee = edgeEvaluator();
        stm.setEdgeEvaluator(ee);
        const state = getState();
        expect(state.type).toBe("INITIALIZED");
        expect(state.edgeEvaluator).toBe(ee);
      });
    });
    describe("in INITIALIZED", () => {
      it("does not transition READY_TO_LOAD_GRAPH", () => {
        const {getState, stm} = example(readyToLoadGraph());
        const ee = edgeEvaluator();
        stm.setEdgeEvaluator(ee);
        const state = getState();
        expect(getSubstate(state).type).toBe("READY_TO_LOAD_GRAPH");
        expect(state.edgeEvaluator).toBe(ee);
      });
      it("does not transition READY_TO_RUN_PAGERANK", () => {
        const {getState, stm} = example(readyToRunPagerank());
        const ee = edgeEvaluator();
        stm.setEdgeEvaluator(ee);
        const state = getState();
        expect(getSubstate(state).type).toBe("READY_TO_RUN_PAGERANK");
        expect(state.edgeEvaluator).toBe(ee);
      });
      it("does not transition PAGERANK_EVALUATED", () => {
        const {getState, stm} = example(pagerankEvaluated());
        const ee = edgeEvaluator();
        stm.setEdgeEvaluator(ee);
        const state = getState();
        expect(getSubstate(state).type).toBe("PAGERANK_EVALUATED");
        expect(state.edgeEvaluator).toBe(ee);
      });
    });
  });

  describe("loadGraph", () => {
    it("can only be called when READY_TO_LOAD_GRAPH", async () => {
      const badStates = [
        initialState(),
        readyToRunPagerank(),
        pagerankEvaluated(),
      ];
      for (const b of badStates) {
        const {stm} = example(b);
        await expect(stm.loadGraph(new Assets("/my/gateway/"))).rejects.toThrow(
          "incorrect state"
        );
      }
    });
    it("passes along the adapters and repo", () => {
      const {stm, loadGraphMock} = example(readyToLoadGraph());
      expect(loadGraphMock).toHaveBeenCalledTimes(0);
      const assets = new Assets("/my/gateway/");
      stm.loadGraph(assets);
      expect(loadGraphMock).toHaveBeenCalledTimes(1);
      expect(loadGraphMock.mock.calls[0]).toHaveLength(2);
      expect(loadGraphMock.mock.calls[0][0]).toBe(assets);
      expect(loadGraphMock.mock.calls[0][1]).toEqual(makeRepo("foo", "bar"));
    });
    it("immediately sets loading status", () => {
      const {getState, stm} = example(readyToLoadGraph());
      expect(loading(getState())).toBe("NOT_LOADING");
      stm.loadGraph(new Assets("/my/gateway/"));
      expect(loading(getState())).toBe("LOADING");
      expect(getSubstate(getState()).type).toBe("READY_TO_LOAD_GRAPH");
    });
    it("transitions to READY_TO_RUN_PAGERANK on success", async () => {
      const {getState, stm, loadGraphMock} = example(readyToLoadGraph());
      const gwa = graphWithAdapters();
      loadGraphMock.mockResolvedValue(gwa);
      const succeeded = await stm.loadGraph(new Assets("/my/gateway/"));
      expect(succeeded).toBe(true);
      const state = getState();
      const substate = getSubstate(state);
      expect(loading(state)).toBe("NOT_LOADING");
      expect(substate.type).toBe("READY_TO_RUN_PAGERANK");
      if (substate.type !== "READY_TO_RUN_PAGERANK") {
        throw new Error("Impossible");
      }
      expect(substate.graphWithAdapters).toBe(gwa);
    });
    it("does not transition if another transition happens first", async () => {
      const {getState, stm, loadGraphMock} = example(readyToLoadGraph());
      const swappedRepo = makeRepo("too", "fast");
      loadGraphMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            stm.setRepo(swappedRepo);
            resolve(graphWithAdapters());
          })
      );
      const succeeded = await stm.loadGraph(new Assets("/my/gateway/"));
      expect(succeeded).toBe(false);
      const state = getState();
      const substate = getSubstate(state);
      expect(loading(state)).toBe("NOT_LOADING");
      expect(substate.type).toBe("READY_TO_LOAD_GRAPH");
      expect(state.repo).toBe(swappedRepo);
    });
    it("sets loading state FAILED on reject", async () => {
      const {getState, stm, loadGraphMock} = example(readyToLoadGraph());
      const error = new Error("Oh no!");
      // $ExpectFlowError
      console.error = jest.fn();
      loadGraphMock.mockRejectedValue(error);
      const succeeded = await stm.loadGraph(new Assets("/my/gateway/"));
      expect(succeeded).toBe(false);
      const state = getState();
      const substate = getSubstate(state);
      expect(loading(state)).toBe("FAILED");
      expect(substate.type).toBe("READY_TO_LOAD_GRAPH");
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  describe("runPagerank", () => {
    it("can only be called when READY_TO_RUN_PAGERANK or PAGERANK_EVALUATED", async () => {
      const badStates = [initialState(), readyToLoadGraph()];
      for (const b of badStates) {
        const {stm} = example(b);
        await expect(stm.runPagerank(NodeAddress.empty)).rejects.toThrow(
          "incorrect state"
        );
      }
    });
    it("can be run when READY_TO_RUN_PAGERANK or PAGERANK_EVALUATED", async () => {
      const goodStates = [readyToRunPagerank(), pagerankEvaluated()];
      for (const g of goodStates) {
        const {stm, getState, pagerankMock} = example(g);
        const pnd = pagerankNodeDecomposition();
        pagerankMock.mockResolvedValue(pnd);
        await stm.runPagerank(NodeAddress.empty);
        const state = getState();
        const substate = getSubstate(state);
        if (substate.type !== "PAGERANK_EVALUATED") {
          throw new Error("Impossible");
        }
        expect(substate.type).toBe("PAGERANK_EVALUATED");
        expect(substate.pagerankNodeDecomposition).toBe(pnd);
      }
    });
    it("immediately sets loading status", () => {
      const {getState, stm} = example(readyToRunPagerank());
      expect(loading(getState())).toBe("NOT_LOADING");
      stm.runPagerank(NodeAddress.empty);
      expect(loading(getState())).toBe("LOADING");
    });
    it("calls pagerank with the totalScoreNodePrefix option", async () => {
      const {pagerankMock, stm} = example(readyToRunPagerank());
      const foo = NodeAddress.fromParts(["foo"]);
      await stm.runPagerank(foo);
      const args = pagerankMock.mock.calls[0];
      expect(args[2].totalScoreNodePrefix).toBe(foo);
    });
    it("does not transition if another transition happens first", async () => {
      const {getState, stm, pagerankMock} = example(readyToRunPagerank());
      const swappedRepo = makeRepo("too", "fast");
      pagerankMock.mockImplementation(
        () =>
          new Promise((resolve) => {
            stm.setRepo(swappedRepo);
            resolve(graphWithAdapters());
          })
      );
      await stm.runPagerank(NodeAddress.empty);
      const state = getState();
      const substate = getSubstate(state);
      expect(loading(state)).toBe("NOT_LOADING");
      expect(substate.type).toBe("READY_TO_LOAD_GRAPH");
      expect(state.repo).toBe(swappedRepo);
    });
    it("sets loading state FAILED on reject", async () => {
      const {getState, stm, pagerankMock} = example(readyToRunPagerank());
      const error = new Error("Oh no!");
      // $ExpectFlowError
      console.error = jest.fn();
      pagerankMock.mockRejectedValue(error);
      await stm.runPagerank(NodeAddress.empty);
      const state = getState();
      const substate = getSubstate(state);
      expect(loading(state)).toBe("FAILED");
      expect(substate.type).toBe("READY_TO_RUN_PAGERANK");
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  describe("loadGraphAndRunPagerank", () => {
    it("errors if called with uninitialized state", async () => {
      const {stm} = example(initialState());
      await expect(
        stm.loadGraphAndRunPagerank(new Assets("gateway"), NodeAddress.empty)
      ).rejects.toThrow("incorrect state");
    });
    it("when READY_TO_LOAD_GRAPH, loads graph then runs pagerank", async () => {
      const {stm} = example(readyToLoadGraph());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      stm.loadGraph.mockResolvedValue(true);
      const assets = new Assets("/gateway/");
      const prefix = NodeAddress.fromParts(["bar"]);
      await stm.loadGraphAndRunPagerank(assets, prefix);
      expect(stm.loadGraph).toHaveBeenCalledTimes(1);
      expect(stm.loadGraph).toHaveBeenCalledWith(assets);
      expect(stm.runPagerank).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledWith(prefix);
    });
    it("does not run pagerank if loadGraph did not succeed", async () => {
      const {stm} = example(readyToLoadGraph());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      stm.loadGraph.mockResolvedValue(false);
      const assets = new Assets("/gateway/");
      const prefix = NodeAddress.fromParts(["bar"]);
      await stm.loadGraphAndRunPagerank(assets, prefix);
      expect(stm.loadGraph).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledTimes(0);
    });
    it("when READY_TO_RUN_PAGERANK, runs pagerank", async () => {
      const {stm} = example(readyToRunPagerank());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      const prefix = NodeAddress.fromParts(["bar"]);
      await stm.loadGraphAndRunPagerank(new Assets("/gateway/"), prefix);
      expect(stm.loadGraph).toHaveBeenCalledTimes(0);
      expect(stm.runPagerank).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledWith(prefix);
    });
    it("when PAGERANK_EVALUATED, runs pagerank", async () => {
      const {stm} = example(pagerankEvaluated());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      const prefix = NodeAddress.fromParts(["bar"]);
      await stm.loadGraphAndRunPagerank(new Assets("/gateway/"), prefix);
      expect(stm.loadGraph).toHaveBeenCalledTimes(0);
      expect(stm.runPagerank).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledWith(prefix);
    });
  });
});
