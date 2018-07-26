// @flow
import React from "react";
import {shallow, mount} from "enzyme";
import enzymeToJSON from "enzyme-to-json";

import MemoryLocalStore from "../memoryLocalStore";
import * as RepositorySelectModule from "./RepositorySelect";
import {
  RepositorySelect,
  PureRepositorySelect,
  loadRepositorySelectStatus,
  REPO_KEY,
  REPO_REGISTRY_API,
} from "./RepositorySelect";

require("../testUtil").configureEnzyme();
require("../testUtil").configureAphrodite();

describe("app/credExplorer/RepositorySelect", () => {
  describe("PureRepositorySelect", () => {
    it("renders an empty select while loading", () => {
      const e = shallow(
        <PureRepositorySelect state={{type: "LOADING"}} onChange={(s) => {}} />
      );
      const span = e.find("span");
      expect(span.text()).toBe("Please choose a repository to inspect:");
      const select = e.find("select");
      expect(select).toHaveLength(0);
    });
    it("renders an error message if no repositories are available", () => {
      const e = shallow(
        <PureRepositorySelect state={{type: "NO_REPOS"}} onChange={(s) => {}} />
      );
      const span = e.find("span");
      expect(span.text()).toBe("Error: No repositories found.");
    });
    it("renders an error message if there was an error while loading", () => {
      const e = shallow(
        <PureRepositorySelect state={{type: "FAILURE"}} onChange={(s) => {}} />
      );
      const span = e.find("span");
      expect(span.text()).toBe("Error: Unable to load repository registry.");
    });
    it("renders a select with all available repos as options", () => {
      const availableRepos = [
        {owner: "foo", name: "bar"},
        {owner: "zod", name: "zoink"},
      ];
      const selectedRepo = availableRepos[0];
      const e = shallow(
        <PureRepositorySelect
          state={{type: "VALID", availableRepos, selectedRepo}}
          onChange={(s) => {}}
        />
      );
      const options = e.find("option");
      expect(options.map((x) => x.text())).toEqual(["foo/bar", "zod/zoink"]);
    });
    it("the selectedRepo is selected", () => {
      const availableRepos = [
        {owner: "foo", name: "bar"},
        {owner: "zod", name: "zoink"},
      ];
      const selectedRepo = availableRepos[0];
      const e = shallow(
        <PureRepositorySelect
          state={{type: "VALID", availableRepos, selectedRepo}}
          onChange={(s) => {}}
        />
      );
      expect(e.find("select").prop("value")).toBe("foo/bar");
    });
    it("clicking an option triggers the onChange", () => {
      const availableRepos = [
        {owner: "foo", name: "bar"},
        {owner: "zod", name: "zoink"},
      ];
      let selectedRepo = availableRepos[0];
      const onChange = (s) => {
        selectedRepo = s;
      };
      const e = shallow(
        <PureRepositorySelect
          state={{type: "VALID", availableRepos, selectedRepo}}
          onChange={onChange}
        />
      );
      expect(selectedRepo).toEqual(availableRepos[0]);
      e.find("select").simulate("change", {target: {value: "zod/zoink"}});
      expect(selectedRepo).toEqual(availableRepos[1]);
    });
  });

  describe("loadRepositorySelectStatus", () => {
    beforeEach(() => {
      fetch.resetMocks();
    });
    function expectSuccessful(
      fetchReturn,
      localStore,
      expectedAvailableRepos,
      expectedSelectedRepo
    ) {
      fetch.mockResponseOnce(fetchReturn);
      const result = loadRepositorySelectStatus(localStore);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(REPO_REGISTRY_API);
      return result.then((status) => {
        expect(status.type).toBe("VALID");
        if (status.type !== "VALID") {
          throw new Error("Impossible");
        }
        expect(status.availableRepos).toEqual(expectedAvailableRepos);
        expect(status.selectedRepo).toEqual(expectedSelectedRepo);
      });
    }
    it("calls fetch and handles a simple success", () => {
      const fetchResult = JSON.stringify({"foo/bar": true});
      const repo = {owner: "foo", name: "bar"};
      return expectSuccessful(
        fetchResult,
        new MemoryLocalStore(),
        [repo],
        repo
      );
    });
    it("returns repos in sorted order, and selects the first repo", () => {
      const fetchResult = JSON.stringify({
        "foo/bar": true,
        "a/z": true,
        "a/b": true,
      });
      const repos = [
        {owner: "a", name: "b"},
        {owner: "a", name: "z"},
        {owner: "foo", name: "bar"},
      ];
      return expectSuccessful(
        fetchResult,
        new MemoryLocalStore(),
        repos,
        repos[0]
      );
    });
    it("returns FAILURE on invalid fetch response", () => {
      fetch.mockResponseOnce(JSON.stringify(["hello"]));
      return loadRepositorySelectStatus(new MemoryLocalStore()).then(
        (renderState) => {
          expect(renderState).toEqual({type: "FAILURE"});
        }
      );
    });
    it("returns FAILURE on fetch failure", () => {
      fetch.mockReject(new Error("some failure"));
      return loadRepositorySelectStatus(new MemoryLocalStore()).then(
        (renderState) => {
          expect(renderState).toEqual({type: "FAILURE"});
        }
      );
    });
    it("loads selectedRepo from localStore, if available", () => {
      const fetchResult = JSON.stringify({
        "foo/bar": true,
        "a/z": true,
        "a/b": true,
      });
      const repos = [
        {owner: "a", name: "b"},
        {owner: "a", name: "z"},
        {owner: "foo", name: "bar"},
      ];
      const localStore = new MemoryLocalStore();
      localStore.set(REPO_KEY, {owner: "a", name: "z"});
      return expectSuccessful(fetchResult, localStore, repos, repos[1]);
    });
    it("ignores selectedRepo from localStore, if not available", () => {
      const fetchResult = JSON.stringify({
        "foo/bar": true,
        "a/z": true,
        "a/b": true,
      });
      const repos = [
        {owner: "a", name: "b"},
        {owner: "a", name: "z"},
        {owner: "foo", name: "bar"},
      ];
      const localStore = new MemoryLocalStore();
      localStore.set(REPO_KEY, {owner: "non", name: "existent"});
      return expectSuccessful(fetchResult, localStore, repos, repos[0]);
    });
  });

  describe("RepositorySelect", () => {
    it("renders an empty select while loading", () => {
      const e = shallow(
        <RepositorySelect
          onChange={(s) => {}}
          localStore={new MemoryLocalStore()}
        />
      );
      const span = e.find("span");
      expect(span.text()).toBe("Please choose a repository to inspect:");
      const select = e.find("select");
      expect(select).toHaveLength(0);
    });
    it.only("renders an error message if no repositories are available", async (done) => {
      const promise = Promise.resolve({type: "NO_REPOS"});
      console.error("setup mock");
      RepositorySelectModule.loadRepositorySelectStatus = jest.fn(
        () => promise
      );
      const e = shallow(
        <RepositorySelect
          onChange={(s) => {}}
          localStore={new MemoryLocalStore()}
        />
      );
      console.error("await promise");
      await promise;
      console.error("waited");
      setImmediate(() => {
        try {
          e.update();
          const span = e.find("span");
          expect(span.text()).toBe("Error: No repositories found.");
          done();
        } catch (e) {
          done.fail(e);
        }
      });
    });
    it("renders an error message if there was an error while loading", () => {
      const e = shallow(
        <PureRepositorySelect state={{type: "FAILURE"}} onChange={(s) => {}} />
      );
      const span = e.find("span");
      expect(span.text()).toBe("Error: Unable to load repository registry.");
    });
    it("renders a select with all available repos as options", () => {
      const availableRepos = [
        {owner: "foo", name: "bar"},
        {owner: "zod", name: "zoink"},
      ];
      const selectedRepo = availableRepos[0];
      const e = shallow(
        <PureRepositorySelect
          state={{type: "VALID", availableRepos, selectedRepo}}
          onChange={(s) => {}}
        />
      );
      const options = e.find("option");
      expect(options.map((x) => x.text())).toEqual(["foo/bar", "zod/zoink"]);
    });
    it("the selectedRepo is selected", () => {
      const availableRepos = [
        {owner: "foo", name: "bar"},
        {owner: "zod", name: "zoink"},
      ];
      const selectedRepo = availableRepos[0];
      const e = shallow(
        <PureRepositorySelect
          state={{type: "VALID", availableRepos, selectedRepo}}
          onChange={(s) => {}}
        />
      );
      expect(e.find("select").prop("value")).toBe("foo/bar");
    });
    it("clicking an option triggers the onChange", () => {
      const availableRepos = [
        {owner: "foo", name: "bar"},
        {owner: "zod", name: "zoink"},
      ];
      let selectedRepo = availableRepos[0];
      const onChange = (s) => {
        selectedRepo = s;
      };
      const e = shallow(
        <PureRepositorySelect
          state={{type: "VALID", availableRepos, selectedRepo}}
          onChange={onChange}
        />
      );
      expect(selectedRepo).toEqual(availableRepos[0]);
      e.find("select").simulate("change", {target: {value: "zod/zoink"}});
      expect(selectedRepo).toEqual(availableRepos[1]);
    });
  });

  /**
  beforeEach(() => {
    fetch.resetMocks();
  });
  function setup() {
    const result: any = {selectedRepo: null};
    const onChange = (selectedRepo) => {
      result.selectedRepo = selectedRepo;
    };
    const repositorySelector = shallow(
      <RepositorySelector onChange={onChange} />
    );
    return {repositorySelector, result};
  }

  it("displays loading text while waiting for registry", () => {
    const {repositorySelector, result} = setup();
    expect(result.selectedRepo).toBe(null);
    expect(repositorySelector.text()).toBe("Waiting to load available repos");
  });
  it.skip("displays error text if registry failed to load", () => {
    //fetch.mockReject(new Error("Something bad"));
    const {repositorySelector, result} = setup();
    expect(result.selectedRepo).toBe(null);
    expect(repositorySelector.text()).toBe("Error loading repos");
  });
  it.skip("displays error text if no repos are available", () => {
    fetch.mockResponseOnce(JSON.stringify({"foo/bar": true}));
    const promise = fetch("whatever");
    fetch.mockReturnValueOnce(promise);
    const {repositorySelector, result} = setup();
    return promise.then(() => {
      expect(result.selectedRepo).toBe(null);
      expect(repositorySelector.state.availableRepos).toHaveLength(0);
      expect(repositorySelector.text()).toBe(
        "No repos are available. Please see the README for instructions."
      );
    });
  });
  it("displays available repos that were loaded", async (done) => {
    fetch.mockResponseOnce(JSON.stringify({"foo/bar": true}));
    const promise = fetch("whatever");
    fetch.mockReturnValueOnce(promise);

    const {repositorySelector, result} = setup();

    await Promise.all([promise]);
    setImmediate(() => {
      try {
        repositorySelector.update();
        const repo = {owner: "foo", name: "bar"};
        expect(result.selectedRepo).toEqual(repo);
        expect(repositorySelector.state().availableRepos).toEqual([repo]);
        expect(repositorySelector.find("span").text()).toBe(
          "Please choose a repository to inspect:"
        );
        done();
      } catch (e) {
        done.fail(e);
      }
    });
  });
  it("defaults to first available repo", () => {});
  it("uses repo from LocalStore, if available", () => {});
  it("uses first available repo, if LocalStore repo not available", () => {});
  */
});
