// @flow

import {StateTransitionMachine, type AppState} from "./state";

import {Graph, NodeAddress} from "../../core/graph";
import {Assets} from "../../webutil/assets";
import {makeRepoId, type RepoId} from "../../core/repoId";
import {type EdgeEvaluator} from "../../analysis/pagerank";
import {defaultWeights} from "../../analysis/weights";
import type {
  PagerankNodeDecomposition,
  PagerankOptions,
} from "../../analysis/pagerank";

describe("explorer/legacy/state", () => {
  function example(startingState: AppState) {
    const stateContainer = {appState: startingState};
    const getState = () => stateContainer.appState;
    const setState = (appState) => {
      stateContainer.appState = appState;
    };
    const loadGraphMock: JestMockFn<
      [Assets, RepoId],
      Promise<Graph>
    > = jest.fn();

    const pagerankMock: JestMockFn<
      [Graph, EdgeEvaluator, PagerankOptions],
      Promise<PagerankNodeDecomposition>
    > = jest.fn();
    const stm = new StateTransitionMachine(
      getState,
      setState,
      loadGraphMock,
      pagerankMock
    );
    return {getState, stm, loadGraphMock, pagerankMock};
  }
  function readyToLoadGraph(): AppState {
    return {
      type: "READY_TO_LOAD_GRAPH",
      repoId: makeRepoId("foo", "bar"),
      loading: "NOT_LOADING",
    };
  }
  function readyToRunPagerank(): AppState {
    return {
      type: "READY_TO_RUN_PAGERANK",
      repoId: makeRepoId("foo", "bar"),
      loading: "NOT_LOADING",
      graph: new Graph(),
    };
  }
  function pagerankEvaluated(): AppState {
    return {
      type: "PAGERANK_EVALUATED",
      repoId: makeRepoId("foo", "bar"),
      graph: new Graph(),
      pagerankNodeDecomposition: pagerankNodeDecomposition(),
      loading: "NOT_LOADING",
    };
  }
  function pagerankNodeDecomposition() {
    return new Map();
  }
  function defaultTypes() {
    return {nodeTypes: [], edgeTypes: []};
  }
  function loading(state: AppState) {
    return state.loading;
  }

  describe("loadGraph", () => {
    it("can only be called when READY_TO_LOAD_GRAPH", async () => {
      const badStates = [readyToRunPagerank(), pagerankEvaluated()];
      for (const b of badStates) {
        const {stm} = example(b);
        await expect(stm.loadGraph(new Assets("/my/gateway/"))).rejects.toThrow(
          "incorrect state"
        );
      }
    });
    it("passes along the repoId", () => {
      const {stm, loadGraphMock} = example(readyToLoadGraph());
      expect(loadGraphMock).toHaveBeenCalledTimes(0);
      const assets = new Assets("/my/gateway/");
      stm.loadGraph(assets);
      expect(loadGraphMock).toHaveBeenCalledTimes(1);
      expect(loadGraphMock).toHaveBeenCalledWith(
        assets,
        makeRepoId("foo", "bar")
      );
    });
    it("immediately sets loading status", () => {
      const {getState, stm} = example(readyToLoadGraph());
      expect(loading(getState())).toBe("NOT_LOADING");
      stm.loadGraph(new Assets("/my/gateway/"));
      expect(loading(getState())).toBe("LOADING");
      expect(getState().type).toBe("READY_TO_LOAD_GRAPH");
    });
    it("transitions to READY_TO_RUN_PAGERANK on success", async () => {
      const {getState, stm, loadGraphMock} = example(readyToLoadGraph());
      const graph = new Graph();
      loadGraphMock.mockReturnValue(Promise.resolve(graph));
      const succeeded = await stm.loadGraph(new Assets("/my/gateway/"));
      expect(succeeded).toBe(true);
      const state = getState();
      expect(loading(state)).toBe("NOT_LOADING");
      expect(state.type).toBe("READY_TO_RUN_PAGERANK");
      if (state.type !== "READY_TO_RUN_PAGERANK") {
        throw new Error("Impossible");
      }
      expect(state.graph).toBe(graph);
    });
    it("sets loading state FAILED on reject", async () => {
      const {getState, stm, loadGraphMock} = example(readyToLoadGraph());
      const error = new Error("Oh no!");
      // $ExpectFlowError
      console.error = jest.fn();
      loadGraphMock.mockReturnValue(Promise.reject(error));
      const succeeded = await stm.loadGraph(new Assets("/my/gateway/"));
      expect(succeeded).toBe(false);
      const state = getState();
      expect(loading(state)).toBe("FAILED");
      expect(state.type).toBe("READY_TO_LOAD_GRAPH");
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  describe("runPagerank", () => {
    it("can only be called when READY_TO_RUN_PAGERANK or PAGERANK_EVALUATED", async () => {
      const badState = readyToLoadGraph();
      const {stm} = example(badState);
      await expect(
        stm.runPagerank(defaultWeights(), defaultTypes(), NodeAddress.empty)
      ).rejects.toThrow("incorrect state");
    });
    it("can be run when READY_TO_RUN_PAGERANK or PAGERANK_EVALUATED", async () => {
      const goodStates = [readyToRunPagerank(), pagerankEvaluated()];
      for (const g of goodStates) {
        const {stm, getState, pagerankMock} = example(g);
        const pnd = pagerankNodeDecomposition();
        pagerankMock.mockReturnValue(Promise.resolve(pnd));
        await stm.runPagerank(
          defaultWeights(),
          defaultTypes(),
          NodeAddress.empty
        );
        const state = getState();
        if (state.type !== "PAGERANK_EVALUATED") {
          throw new Error("Impossible");
        }
        expect(state.type).toBe("PAGERANK_EVALUATED");
        expect(state.pagerankNodeDecomposition).toBe(pnd);
      }
    });
    it("immediately sets loading status", () => {
      const {getState, stm} = example(readyToRunPagerank());
      expect(loading(getState())).toBe("NOT_LOADING");
      stm.runPagerank(defaultWeights(), defaultTypes(), NodeAddress.empty);
      expect(loading(getState())).toBe("LOADING");
    });
    it("calls pagerank with the totalScoreNodePrefix option", async () => {
      const {pagerankMock, stm} = example(readyToRunPagerank());
      const foo = NodeAddress.fromParts(["foo"]);
      await stm.runPagerank(defaultWeights(), defaultTypes(), foo);
      const args = pagerankMock.mock.calls[0];
      expect(args[2].totalScoreNodePrefix).toBe(foo);
    });
    it("sets loading state FAILED on reject", async () => {
      const {getState, stm, pagerankMock} = example(readyToRunPagerank());
      const error = new Error("Oh no!");
      // $ExpectFlowError
      console.error = jest.fn();
      pagerankMock.mockReturnValue(Promise.reject(error));
      await stm.runPagerank(
        defaultWeights(),
        defaultTypes(),
        NodeAddress.empty
      );
      const state = getState();
      expect(loading(state)).toBe("FAILED");
      expect(state.type).toBe("READY_TO_RUN_PAGERANK");
      expect(console.error).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledWith(error);
    });
  });

  describe("loadGraphAndRunPagerank", () => {
    it("when READY_TO_LOAD_GRAPH, loads graph then runs pagerank", async () => {
      const {stm} = example(readyToLoadGraph());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      stm.loadGraph.mockResolvedValue(true);
      const assets = new Assets("/gateway/");
      const prefix = NodeAddress.fromParts(["bar"]);
      const types = defaultTypes();
      const wt = defaultWeights();
      await stm.loadGraphAndRunPagerank(assets, wt, types, prefix);
      expect(stm.loadGraph).toHaveBeenCalledTimes(1);
      expect(stm.loadGraph).toHaveBeenCalledWith(assets);
      expect(stm.runPagerank).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledWith(wt, types, prefix);
    });
    it("does not run pagerank if loadGraph did not succeed", async () => {
      const {stm} = example(readyToLoadGraph());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      stm.loadGraph.mockResolvedValue(false);
      const assets = new Assets("/gateway/");
      const prefix = NodeAddress.fromParts(["bar"]);
      await stm.loadGraphAndRunPagerank(
        assets,
        defaultWeights(),
        defaultTypes(),
        prefix
      );
      expect(stm.loadGraph).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledTimes(0);
    });
    it("when READY_TO_RUN_PAGERANK, runs pagerank", async () => {
      const {stm} = example(readyToRunPagerank());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      const prefix = NodeAddress.fromParts(["bar"]);
      const wt = defaultWeights();
      const types = defaultTypes();
      await stm.loadGraphAndRunPagerank(
        new Assets("/gateway/"),
        wt,
        types,
        prefix
      );
      expect(stm.loadGraph).toHaveBeenCalledTimes(0);
      expect(stm.runPagerank).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledWith(wt, types, prefix);
    });
    it("when PAGERANK_EVALUATED, runs pagerank", async () => {
      const {stm} = example(pagerankEvaluated());
      (stm: any).loadGraph = jest.fn();
      (stm: any).runPagerank = jest.fn();
      const prefix = NodeAddress.fromParts(["bar"]);
      const wt = defaultWeights();
      const types = defaultTypes();
      await stm.loadGraphAndRunPagerank(
        new Assets("/gateway/"),
        wt,
        types,
        prefix
      );
      expect(stm.loadGraph).toHaveBeenCalledTimes(0);
      expect(stm.runPagerank).toHaveBeenCalledTimes(1);
      expect(stm.runPagerank).toHaveBeenCalledWith(wt, types, prefix);
    });
  });
});
