// @flow

import React from "react";
import {shallow} from "enzyme";

import * as WeightedGraph from "../../core/weightedGraph";
import {Assets} from "../../webutil/assets";
import testLocalStore from "../../webutil/testLocalStore";

import {PagerankTable} from "./pagerankTable/Table";
import {createApp, LoadingIndicator, ProjectDetail} from "./App";
import {TimelineCred} from "../../analysis/timeline/timelineCred";
import {defaultParams} from "../../analysis/timeline/params";

require("../../webutil/testUtil").configureEnzyme();

describe("explorer/legacy/App", () => {
  function example() {
    let setState, getState;
    const loadTimelineCred = jest.fn();
    const runPagerank = jest.fn();
    const loadTimelineCredAndRunPagerank = jest.fn();
    const localStore = testLocalStore();
    function createMockSTM(_getState, _setState) {
      setState = _setState;
      getState = _getState;
      return {
        loadTimelineCred,
        runPagerank,
        loadTimelineCredAndRunPagerank,
      };
    }
    const App = createApp(createMockSTM);
    const el = shallow(
      <App
        assets={new Assets("/foo/")}
        localStore={localStore}
        projectId={"foo/bar"}
      />
    );
    if (setState == null || getState == null) {
      throw new Error("Initialization problems");
    }
    return {
      el,
      setState,
      getState,
      loadTimelineCred,
      runPagerank,
      loadTimelineCredAndRunPagerank,
      localStore,
    };
  }

  const exampleStates = {
    readyToLoadGraph: (loadingState) => {
      return () => ({
        type: "READY_TO_LOAD_GRAPH",
        projectId: "foo/bar",
        loading: loadingState,
      });
    },
    readyToRunPagerank: (loadingState) => {
      return () => ({
        type: "READY_TO_RUN_PAGERANK",
        projectId: "foo/bar",
        loading: loadingState,
        timelineCred: new TimelineCred(
          WeightedGraph.empty(),
          [],
          new Map(),
          defaultParams(),
          []
        ),
        pluginDeclarations: [],
      });
    },
    pagerankEvaluated: (loadingState) => {
      return () => ({
        type: "PAGERANK_EVALUATED",
        projectId: "foo/bar",
        loading: loadingState,
        timelineCred: new TimelineCred(
          WeightedGraph.empty(),
          [],
          new Map(),
          defaultParams(),
          []
        ),
        pluginDeclarations: [],
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
    const link = el
      .find("Link")
      .filterWhere((x) => x.children().text().includes("feedback"));
    expect(link).toHaveLength(1);
    expect(link.prop("href")).toMatch(/https?:\/\//);
  });

  it("instantiates a ProjectDetail component with correct props", () => {
    const {el} = example();
    const projectDetail = el.find(ProjectDetail);
    const correctProps = {projectId: "foo/bar"};
    expect(projectDetail.props()).toEqual(correctProps);
  });

  it("ProjectDetail component renders projectId correctly", () => {
    const projectDetail = shallow(<ProjectDetail projectId={"foo/bar"} />);
    const title = projectDetail.findWhere(
      (p) => p.is("p") && p.text() === "foo/bar"
    );
    expect(title).toHaveLength(1);
  });

  describe("when in state:", () => {
    function testAnalyzeCredButton(stateFn, {disabled}) {
      const adjective = disabled ? "disabled" : "working";
      it(`has a ${adjective} analyze cred button`, () => {
        const {el, loadTimelineCredAndRunPagerank, setState} = example();
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
          expect(loadTimelineCredAndRunPagerank).toBeCalledTimes(1);
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
        expect(prt).toHaveLength(present ? 1 : 0);
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
