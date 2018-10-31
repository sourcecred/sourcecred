// @flow

import React from "react";
import {shallow} from "enzyme";

import {Graph} from "../../core/graph";
import {makeRepoId} from "../../core/repoId";
import {Assets} from "../assets";
import testLocalStore from "../testLocalStore";
import {DynamicAdapterSet, StaticAdapterSet} from "../adapters/adapterSet";
import {FactorioStaticAdapter} from "../../plugins/demo/appAdapter";
import {defaultWeightsForAdapter} from "./weights/weights";

import RepositorySelect from "./RepositorySelect";
import {PagerankTable} from "./pagerankTable/Table";
import {createApp, LoadingIndicator} from "./App";
import {uninitializedState} from "./state";
import {Prefix as GithubPrefix} from "../../plugins/github/nodes";

require("../testUtil").configureEnzyme();

describe("app/credExplorer/App", () => {
  function example() {
    let setState, getState;
    const setRepoId = jest.fn();
    const loadGraph = jest.fn();
    const runPagerank = jest.fn();
    const loadGraphAndRunPagerank = jest.fn();
    const localStore = testLocalStore();
    function createMockSTM(_getState, _setState) {
      setState = _setState;
      getState = _getState;
      return {
        setRepoId,
        loadGraph,
        runPagerank,
        loadGraphAndRunPagerank,
      };
    }
    const App = createApp(createMockSTM);
    const el = shallow(
      <App
        assets={new Assets("/foo/")}
        adapters={new StaticAdapterSet([])}
        localStore={localStore}
      />
    );
    if (setState == null || getState == null) {
      throw new Error("Initialization problems");
    }
    return {
      el,
      setState,
      getState,
      setRepoId,
      loadGraph,
      runPagerank,
      loadGraphAndRunPagerank,
      localStore,
    };
  }

  const emptyAdapters = new DynamicAdapterSet(new StaticAdapterSet([]), []);
  const exampleStates = {
    uninitialized: uninitializedState,
    readyToLoadGraph: (loadingState) => {
      return () => ({
        type: "READY_TO_LOAD_GRAPH",
        repoId: makeRepoId("foo", "bar"),
        loading: loadingState,
      });
    },
    readyToRunPagerank: (loadingState) => {
      return () => ({
        type: "READY_TO_RUN_PAGERANK",
        repoId: makeRepoId("foo", "bar"),
        loading: loadingState,
        graphWithAdapters: {graph: new Graph(), adapters: emptyAdapters},
      });
    },
    pagerankEvaluated: (loadingState) => {
      return () => ({
        type: "PAGERANK_EVALUATED",
        repoId: makeRepoId("foo", "bar"),
        loading: loadingState,
        graphWithAdapters: {graph: new Graph(), adapters: emptyAdapters},
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
    expect(uninitializedState()).not.toBe(uninitializedState()); // sanity check
    const newState = uninitializedState();
    setState(newState);
    expect(el.state().appState).toBe(newState);
  });
  it("localStore is wired properly", () => {
    const {el, localStore} = example();
    expect(el.instance().props.localStore).toBe(localStore);
  });

  it("should have a feedback link with a valid URL", () => {
    const {el} = example();
    const link = el.find("Link").filterWhere((x) =>
      x
        .children()
        .text()
        .includes("feedback")
    );
    expect(link).toHaveLength(1);
    expect(link.prop("href")).toMatch(/https?:\/\//);
  });

  describe("when in state:", () => {
    function testRepositorySelect(stateFn) {
      it("creates a working RepositorySelect", () => {
        const {el, setRepoId, setState, localStore} = example();
        setState(stateFn());
        const rs = el.find(RepositorySelect);
        const newRepoId = makeRepoId("zoo", "zod");
        rs.props().onChange(newRepoId);
        expect(setRepoId).toHaveBeenCalledWith(newRepoId);
        expect(rs.props().localStore).toBe(localStore);
      });
    }

    function testAnalyzeCredButton(stateFn, {disabled}) {
      const adjective = disabled ? "disabled" : "working";
      it(`has a ${adjective} analyze cred button`, () => {
        const {el, loadGraphAndRunPagerank, setState} = example();
        setState(stateFn());
        el.update();
        const button = el.findWhere(
          (b) => b.text() === "Analyze cred" && b.is("button")
        );
        if (disabled) {
          expect(button.props().disabled).toBe(true);
        } else {
          expect(button.props().disabled).toBe(false);
          button.simulate("click");
          expect(loadGraphAndRunPagerank).toBeCalledTimes(1);
          expect(loadGraphAndRunPagerank).toBeCalledWith(
            el.instance().props.assets,
            el.instance().props.adapters,
            el.instance().state.weightedTypes,
            GithubPrefix.user
          );
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
          if (state.type !== "PAGERANK_EVALUATED") {
            throw new Error("This test case is impossible to satisfy");
          }
          const adapters = state.graphWithAdapters.adapters;
          const pnd = state.pagerankNodeDecomposition;
          const weightedTypes = el.instance().state.weightedTypes;
          expect(prt.props().adapters).toBe(adapters);
          expect(prt.props().pnd).toBe(pnd);
          expect(prt.props().weightedTypes).toBe(weightedTypes);
          const prtWeightedTypesChange = prt.props().onWeightedTypesChange;
          const newTypes = defaultWeightsForAdapter(
            new FactorioStaticAdapter()
          );
          prtWeightedTypesChange(newTypes);
          expect(el.instance().state.weightedTypes).toBe(newTypes);
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
      {analyzeCredDisabled, hasPagerankTable}
    ) {
      describe(suiteName, () => {
        testRepositorySelect(stateFn);
        testAnalyzeCredButton(stateFn, {disabled: analyzeCredDisabled});
        testPagerankTable(stateFn, hasPagerankTable);
        testLoadingIndicator(stateFn);
      });
    }

    stateTestSuite("UNINITIALIZED", exampleStates.uninitialized, {
      analyzeCredDisabled: true,
      hasPagerankTable: false,
    });
    describe("READY_TO_LOAD_GRAPH", () => {
      for (const loadingState of ["LOADING", "NOT_LOADING", "FAILED"]) {
        stateTestSuite(
          loadingState,
          exampleStates.readyToLoadGraph(loadingState),
          {
            analyzeCredDisabled: loadingState === "LOADING",
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
            analyzeCredDisabled: loadingState === "LOADING",
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
            analyzeCredDisabled: loadingState === "LOADING",
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
