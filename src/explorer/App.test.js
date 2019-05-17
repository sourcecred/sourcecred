// @flow

import React from "react";
import {shallow} from "enzyme";

import {Graph} from "../core/graph";
import {makeRepoId} from "../core/repoId";
import {Assets} from "../webutil/assets";
import testLocalStore from "../webutil/testLocalStore";
import {
  DynamicExplorerAdapterSet,
  StaticExplorerAdapterSet,
} from "./adapters/explorerAdapterSet";
import {FactorioStaticAdapter} from "../plugins/demo/explorerAdapter";
import {defaultWeightsForAdapter} from "./weights/weights";

import {PagerankTable} from "./pagerankTable/Table";
import {createApp, LoadingIndicator, ProjectDetail} from "./App";
import {Prefix as GithubPrefix} from "../plugins/github/nodes";

require("../webutil/testUtil").configureEnzyme();

describe("explorer/App", () => {
  function example() {
    let setState, getState;
    const loadGraph = jest.fn();
    const runPagerank = jest.fn();
    const loadGraphAndRunPagerank = jest.fn();
    const localStore = testLocalStore();
    function createMockSTM(_getState, _setState) {
      setState = _setState;
      getState = _getState;
      return {
        loadGraph,
        runPagerank,
        loadGraphAndRunPagerank,
      };
    }
    const App = createApp(createMockSTM);
    const el = shallow(
      <App
        assets={new Assets("/foo/")}
        adapters={new StaticExplorerAdapterSet([])}
        localStore={localStore}
        repoId={makeRepoId("foo", "bar")}
      />
    );
    if (setState == null || getState == null) {
      throw new Error("Initialization problems");
    }
    return {
      el,
      setState,
      getState,
      loadGraph,
      runPagerank,
      loadGraphAndRunPagerank,
      localStore,
    };
  }

  const emptyAdapters = new DynamicExplorerAdapterSet(
    new StaticExplorerAdapterSet([]),
    []
  );
  const exampleStates = {
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
    const newState = exampleStates.readyToLoadGraph("LOADING")();
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

  it("instantiates a ProjectDetail component with correct props", () => {
    const {el} = example();
    const projectDetail = el.find(ProjectDetail);
    const correctProps = {repoId: makeRepoId("foo", "bar")};
    expect(projectDetail.props()).toEqual(correctProps);
  });

  it("ProjectDetail component renders repoId correctly", () => {
    const repoId = makeRepoId("foo", "bar");
    const projectDetail = shallow(<ProjectDetail repoId={repoId} />);
    const title = projectDetail.findWhere(
      (p) => p.is("p") && p.text() === "foo/bar"
    );
    expect(title).toHaveLength(1);
  });

  describe("when in state:", () => {
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
            el.instance().state.manualWeights,
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
        testAnalyzeCredButton(stateFn, {disabled: analyzeCredDisabled});
        testPagerankTable(stateFn, hasPagerankTable);
        testLoadingIndicator(stateFn);
      });
    }

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
