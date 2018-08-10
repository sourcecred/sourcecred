// @flow

import React from "react";
import {shallow} from "enzyme";

import {Graph} from "../../core/graph";
import {makeRepo} from "../../core/repo";
import testLocalStore from "../testLocalStore";

import RepositorySelect from "./RepositorySelect";
import {PagerankTable} from "./pagerankTable/Table";
import {WeightConfig} from "./WeightConfig";
import {createApp, LoadingIndicator} from "./App";
import {initialState} from "./state";

require("../testUtil").configureEnzyme();

describe("app/credExplorer/App", () => {
  function example() {
    let setState, getState;
    const setRepo = jest.fn();
    const setEdgeEvaluator = jest.fn();
    const loadGraph = jest.fn();
    const runPagerank = jest.fn();
    const localStore = testLocalStore();
    function createMockSTM(_getState, _setState) {
      setState = _setState;
      getState = _getState;
      return {
        setRepo,
        setEdgeEvaluator,
        loadGraph,
        runPagerank,
      };
    }
    const App = createApp(createMockSTM);
    const el = shallow(<App localStore={localStore} />);
    if (setState == null || getState == null) {
      throw new Error("Initialization problems");
    }
    return {
      el,
      setState,
      getState,
      setRepo,
      setEdgeEvaluator,
      loadGraph,
      runPagerank,
      localStore,
    };
  }

  function createEvaluator() {
    return function(_unused_edge) {
      return {toWeight: 1, froWeight: 1};
    };
  }

  function initialized(substate) {
    return {
      type: "INITIALIZED",
      repo: makeRepo("foo", "bar"),
      edgeEvaluator: createEvaluator(),
      substate,
    };
  }

  const exampleStates = {
    uninitialized: initialState,
    readyToLoadGraph: (loadingState) => {
      return () =>
        initialized({
          type: "READY_TO_LOAD_GRAPH",
          loading: loadingState,
        });
    },
    readyToRunPagerank: (loadingState) => {
      return () =>
        initialized({
          type: "READY_TO_RUN_PAGERANK",
          loading: loadingState,
          graphWithAdapters: {graph: new Graph(), adapters: []},
        });
    },
    pagerankEvaluated: (loadingState) => {
      return () =>
        initialized({
          type: "PAGERANK_EVALUATED",
          loading: loadingState,
          graphWithAdapters: {graph: new Graph(), adapters: []},
          pagerankNodeDecomposition: new Map(),
        });
    },
  };

  it("getState is wired properly", () => {
    const {getState, el} = example();
    expect(el.state().appState).toBe(getState());
  });
  it("setState is wired properly", () => {
    const {setState, el} = example();
    expect(initialState()).not.toBe(initialState()); // sanity check
    const newState = initialState();
    setState(newState);
    expect(el.state().appState).toBe(newState);
  });
  it("localStore is wired properly", () => {
    const {el, localStore} = example();
    expect(el.instance().props.localStore).toBe(localStore);
  });

  describe("when in state:", () => {
    function testRepositorySelect(stateFn) {
      it("creates a working RepositorySelect", () => {
        const {el, setRepo, setState, localStore} = example();
        setState(stateFn());
        const rs = el.find(RepositorySelect);
        const newRepo = makeRepo("zoo", "zod");
        rs.props().onChange(newRepo);
        expect(setRepo).toHaveBeenCalledWith(newRepo);
        expect(rs.props().localStore).toBe(localStore);
      });
    }

    function testWeightConfig(stateFn) {
      it("creates a working WeightConfig", () => {
        const {el, setEdgeEvaluator, setState, localStore} = example();
        setState(stateFn());
        const wc = el.find(WeightConfig);
        const ee = createEvaluator();
        wc.props().onChange(ee);
        expect(setEdgeEvaluator).toHaveBeenCalledWith(ee);
        expect(wc.props().localStore).toBe(localStore);
      });
    }

    function testGraphButton(stateFn, {disabled}) {
      const adjective = disabled ? "disabled" : "working";
      it(`has a ${adjective} load graph button`, () => {
        const {el, loadGraph, setState} = example();
        setState(stateFn());
        el.update();
        const button = el.findWhere(
          (b) => b.text() === "Load graph" && b.is("button")
        );
        if (disabled) {
          expect(button.props().disabled).toBe(true);
        } else {
          expect(button.props().disabled).toBe(false);
          button.simulate("click");
          expect(loadGraph).toBeCalledTimes(1);
        }
      });
    }

    function testPagerankButton(stateFn, {disabled}) {
      const adjective = disabled ? "disabled" : "working";
      it(`has a ${adjective} run PageRank button`, () => {
        const {el, runPagerank, setState} = example();
        setState(stateFn());
        el.update();
        const button = el.findWhere(
          (b) => b.text() === "Run PageRank" && b.is("button")
        );
        if (disabled) {
          expect(button.props().disabled).toBe(true);
        } else {
          expect(button.props().disabled).toBe(false);
          button.simulate("click");
          expect(runPagerank).toBeCalledTimes(1);
        }
      });
    }

    function testPagerankTable(stateFn, present: boolean) {
      const verb = present ? "has" : "doesn't have";
      it(`${verb} a PagerankTable`, () => {
        const {el, setState} = example();
        const state = stateFn();
        setState(state);
        el.update();
        const prt = el.find(PagerankTable);
        if (present) {
          expect(prt).toHaveLength(1);
          if (
            state.type !== "INITIALIZED" ||
            state.substate.type !== "PAGERANK_EVALUATED"
          ) {
            throw new Error("This test case is impossible to satisfy");
          }
          const adapters = state.substate.graphWithAdapters.adapters;
          const pnd = state.substate.pagerankNodeDecomposition;
          expect(prt.props().adapters).toBe(adapters);
          expect(prt.props().pnd).toBe(pnd);
        } else {
          expect(prt).toHaveLength(0);
        }
      });
    }

    function testLoadingIndicator(stateFn) {
      it("has a LoadingIndicator", () => {
        const {el, setState} = example();
        const state = stateFn();
        setState(state);
        el.update();
        const li = el.find(LoadingIndicator);
        expect(li.props().appState).toEqual(state);
      });
    }

    function stateTestSuite(
      suiteName,
      stateFn,
      {loadGraphDisabled, runPagerankDisabled, hasPagerankTable}
    ) {
      describe(suiteName, () => {
        testWeightConfig(stateFn);
        testRepositorySelect(stateFn);
        testGraphButton(stateFn, {disabled: loadGraphDisabled});
        testPagerankButton(stateFn, {disabled: runPagerankDisabled});
        testPagerankTable(stateFn, hasPagerankTable);
        testLoadingIndicator(stateFn);
      });
    }

    stateTestSuite("UNINITIALIZED", exampleStates.uninitialized, {
      loadGraphDisabled: true,
      runPagerankDisabled: true,
      hasPagerankTable: false,
    });
    describe("READY_TO_LOAD_GRAPH", () => {
      for (const loadingState of ["LOADING", "NOT_LOADING", "FAILED"]) {
        stateTestSuite(
          loadingState,
          exampleStates.readyToLoadGraph(loadingState),
          {
            loadGraphDisabled: false,
            runPagerankDisabled: true,
            hasPagerankTable: false,
          }
        );
      }
    });

    describe("READY_TO_RUN_PAGERANK", () => {
      for (const loadingState of ["LOADING", "NOT_LOADING", "FAILED"]) {
        stateTestSuite(
          loadingState,
          exampleStates.readyToRunPagerank(loadingState),
          {
            loadGraphDisabled: true,
            runPagerankDisabled: loadingState === "LOADING",
            hasPagerankTable: false,
          }
        );
      }
    });

    describe("PAGERANK_EVALUATED", () => {
      for (const loadingState of ["LOADING", "NOT_LOADING", "FAILED"]) {
        stateTestSuite(
          loadingState,
          exampleStates.pagerankEvaluated(loadingState),
          {
            loadGraphDisabled: true,
            runPagerankDisabled: loadingState === "LOADING",
            hasPagerankTable: true,
          }
        );
      }
    });
  });

  describe("LoadingIndicator", () => {
    describe("displays the right status text when ", () => {
      function testStatusText(stateName, stateFn, expectedText) {
        it(stateName, () => {
          const el = shallow(<LoadingIndicator appState={stateFn()} />);
          expect(el.text()).toEqual(expectedText);
        });
      }
      testStatusText(
        "initializing",
        exampleStates.uninitialized,
        "Initializing..."
      );
      testStatusText(
        "ready to load graph",
        exampleStates.readyToLoadGraph("NOT_LOADING"),
        "Ready to load graph"
      );
      testStatusText(
        "loading graph",
        exampleStates.readyToLoadGraph("LOADING"),
        "Loading graph..."
      );
      testStatusText(
        "failed to load graph",
        exampleStates.readyToLoadGraph("FAILED"),
        "Error while loading graph"
      );
      testStatusText(
        "ready to run pagerank",
        exampleStates.readyToRunPagerank("NOT_LOADING"),
        "Ready to run PageRank"
      );
      testStatusText(
        "running pagerank",
        exampleStates.readyToRunPagerank("LOADING"),
        "Running PageRank..."
      );
      testStatusText(
        "pagerank failed",
        exampleStates.readyToRunPagerank("FAILED"),
        "Error while running PageRank"
      );
      testStatusText(
        "pagerank succeeded",
        exampleStates.pagerankEvaluated("NOT_LOADING"),
        ""
      );
      testStatusText(
        "re-running pagerank",
        exampleStates.pagerankEvaluated("LOADING"),
        "Re-running PageRank..."
      );
      testStatusText(
        "re-running pagerank failed",
        exampleStates.pagerankEvaluated("FAILED"),
        "Error while running PageRank"
      );
    });
  });
});
