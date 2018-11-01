// @flow
import React from "react";
import {shallow, mount} from "enzyme";

import * as NullUtil from "../util/null";
import testLocalStore from "../webutil/testLocalStore";
import RepositorySelect, {
  PureRepositorySelect,
  LocalStoreRepositorySelect,
  loadStatus,
  type Status,
  REPO_ID_KEY,
} from "./RepositorySelect";
import {Assets} from "../webutil/assets";

import {
  toJSON,
  type RepoIdRegistry,
  REPO_ID_REGISTRY_API,
} from "./repoIdRegistry";
import {makeRepoId} from "../core/repoId";

require("../webutil/testUtil").configureEnzyme();
require("../webutil/testUtil").configureAphrodite();

describe("explorer/RepositorySelect", () => {
  beforeEach(() => {
    fetch.resetMocks();
  });

  function mockRegistry(registry: RepoIdRegistry) {
    fetch.mockResponseOnce(JSON.stringify(toJSON(registry)));
  }
  describe("PureRepositorySelect", () => {
    it("doesn't render a select while loading", () => {
      const e = shallow(
        <PureRepositorySelect status={{type: "LOADING"}} onChange={jest.fn()} />
      );
      const span = e.find("span");
      expect(span.text()).toBe("Please choose a repository to inspect:");
      const select = e.find("select");
      expect(select).toHaveLength(0);
    });
    it("renders an error message if no repositories are available", () => {
      const e = shallow(
        <PureRepositorySelect
          status={{type: "NO_REPOS"}}
          onChange={jest.fn()}
        />
      );
      const span = e.find("span");
      expect(span.text()).toBe("Error: No repositories found.");
    });
    it("renders an error message if there was an error while loading", () => {
      const e = shallow(
        <PureRepositorySelect status={{type: "FAILURE"}} onChange={jest.fn()} />
      );
      const span = e.find("span");
      expect(span.text()).toBe(
        "Error: Unable to load repository registry. See console for details."
      );
    });
    it("renders a select with all available repoIds as options", () => {
      const availableRepoIds = [
        makeRepoId("foo", "bar"),
        makeRepoId("zod", "zoink"),
      ];
      const selectedRepoId = availableRepoIds[0];
      const e = shallow(
        <PureRepositorySelect
          status={{type: "VALID", availableRepoIds, selectedRepoId}}
          onChange={jest.fn()}
        />
      );
      const options = e.find("option");
      expect(options.map((x) => x.text())).toEqual(["foo/bar", "zod/zoink"]);
    });
    it("the selectedRepoId is selected", () => {
      const availableRepoIds = [
        makeRepoId("foo", "bar"),
        makeRepoId("zod", "zoink"),
      ];
      const selectedRepoId = availableRepoIds[0];
      const e = shallow(
        <PureRepositorySelect
          status={{type: "VALID", availableRepoIds, selectedRepoId}}
          onChange={jest.fn()}
        />
      );
      expect(e.find("select").prop("value")).toBe("foo/bar");
    });
    it("clicking an option triggers the onChange", () => {
      const availableRepoIds = [
        makeRepoId("foo", "bar"),
        makeRepoId("zod", "zoink"),
      ];
      const onChange = jest.fn();
      const e = shallow(
        <PureRepositorySelect
          status={{
            type: "VALID",
            availableRepoIds,
            selectedRepoId: availableRepoIds[0],
          }}
          onChange={onChange}
        />
      );
      e.find("select").simulate("change", {target: {value: "zod/zoink"}});
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenLastCalledWith(availableRepoIds[1]);
    });
  });

  describe("loadStatus", () => {
    const assets = new Assets("/my/gateway/");
    function expectLoadValidStatus(
      localStore,
      expectedAvailableRepoIds,
      expectedSelectedRepoId
    ) {
      const result = loadStatus(assets, localStore);
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith("/my/gateway" + REPO_ID_REGISTRY_API);
      expect.assertions(7);
      return result.then((status) => {
        expect(status.type).toBe("VALID");
        if (status.type !== "VALID") {
          throw new Error("Impossible");
        }
        expect(status.availableRepoIds).toEqual(expectedAvailableRepoIds);
        expect(status.selectedRepoId).toEqual(expectedSelectedRepoId);
      });
    }
    it("calls fetch and handles a simple success", () => {
      const repoId = makeRepoId("foo", "bar");
      mockRegistry([repoId]);
      return expectLoadValidStatus(testLocalStore(), [repoId], repoId);
    });
    it("returns repoIds in sorted order, and selects the last repoId", () => {
      const repoIds = [
        makeRepoId("a", "b"),
        makeRepoId("a", "z"),
        makeRepoId("foo", "bar"),
      ];
      const nonSortedRepoIds = [repoIds[2], repoIds[0], repoIds[1]];
      mockRegistry(nonSortedRepoIds);
      return expectLoadValidStatus(testLocalStore(), repoIds, repoIds[1]);
    });
    it("returns FAILURE on invalid fetch response", () => {
      fetch.mockResponseOnce(JSON.stringify(["hello"]));
      expect.assertions(4);
      return loadStatus(assets, testLocalStore()).then((status) => {
        expect(status).toEqual({type: "FAILURE"});
        expect(console.error).toHaveBeenCalledTimes(1);
        // $ExpectFlowError
        console.error = jest.fn();
      });
    });
    it("returns FAILURE on fetch failure", () => {
      fetch.mockReject(new Error("some failure"));
      expect.assertions(4);
      return loadStatus(assets, testLocalStore()).then((status) => {
        expect(status).toEqual({type: "FAILURE"});
        expect(console.error).toHaveBeenCalledTimes(1);
        // $ExpectFlowError
        console.error = jest.fn();
      });
    });
    it("returns NO_REPOS on fetch 404", () => {
      fetch.mockResponseOnce("irrelevant", {status: 404});
      expect.assertions(3);
      return loadStatus(assets, testLocalStore()).then((status) => {
        expect(status).toEqual({type: "NO_REPOS"});
      });
    });
    it("loads selectedRepoId from localStore, if available", () => {
      const repoIds = [
        makeRepoId("a", "b"),
        makeRepoId("a", "z"),
        makeRepoId("foo", "bar"),
      ];
      mockRegistry(repoIds);
      const localStore = testLocalStore();
      localStore.set(REPO_ID_KEY, {owner: "a", name: "z"});
      return expectLoadValidStatus(localStore, repoIds, repoIds[1]);
    });
    it("ignores selectedRepoId from localStore, if not available", () => {
      const repoIds = [
        makeRepoId("a", "b"),
        makeRepoId("a", "z"),
        makeRepoId("foo", "bar"),
      ];
      mockRegistry(repoIds);
      const localStore = testLocalStore();
      localStore.set(REPO_ID_KEY, {owner: "non", name: "existent"});
      return expectLoadValidStatus(localStore, repoIds, repoIds[2]);
    });
    it("ignores malformed value in localStore", () => {
      const repoIds = [
        makeRepoId("a", "b"),
        makeRepoId("a", "z"),
        makeRepoId("foo", "bar"),
      ];
      mockRegistry(repoIds);
      const localStore = testLocalStore();
      localStore.set(REPO_ID_KEY, 42);
      return expectLoadValidStatus(localStore, repoIds, repoIds[2]);
    });
  });

  describe("LocalStoreRepositorySelect", () => {
    it("instantiates the child component", () => {
      const status = {type: "LOADING"};
      const onChange = jest.fn();
      const e = shallow(
        <LocalStoreRepositorySelect
          onChange={onChange}
          status={status}
          localStore={testLocalStore()}
        >
          {({status, onChange}) => (
            <PureRepositorySelect status={status} onChange={onChange} />
          )}
        </LocalStoreRepositorySelect>
      );
      const child = e.find("PureRepositorySelect");
      expect(child.props().status).toEqual(status);
    });
    it("passes onChange result up to parent", () => {
      const status = {type: "LOADING"};
      const onChange = jest.fn();
      let childOnChange;
      shallow(
        <LocalStoreRepositorySelect
          onChange={onChange}
          status={status}
          localStore={testLocalStore()}
        >
          {({status, onChange}) => {
            childOnChange = onChange;
            return <PureRepositorySelect status={status} onChange={onChange} />;
          }}
        </LocalStoreRepositorySelect>
      );
      const repoId = {owner: "foo", name: "bar"};
      NullUtil.get(childOnChange)(repoId);
      expect(onChange).toHaveBeenCalledWith(repoId);
      expect(onChange).toHaveBeenCalledTimes(1);
    });
    it("stores onChange result in localStore", () => {
      const status = {type: "LOADING"};
      const onChange = jest.fn();
      const localStore = testLocalStore();
      let childOnChange;
      shallow(
        <LocalStoreRepositorySelect
          onChange={onChange}
          status={status}
          localStore={localStore}
        >
          {({status, onChange}) => {
            childOnChange = onChange;
            return <PureRepositorySelect status={status} onChange={onChange} />;
          }}
        </LocalStoreRepositorySelect>
      );
      const repoId = {owner: "foo", name: "bar"};
      NullUtil.get(childOnChange)(repoId);
      expect(localStore.get(REPO_ID_KEY)).toEqual(repoId);
    });
  });

  describe("RepositorySelect", () => {
    const assets = new Assets("/my/gateway/");

    it("calls `loadStatus` with the proper assets", () => {
      mockRegistry([makeRepoId("irrelevant", "unused")]);
      shallow(
        <RepositorySelect
          assets={assets}
          onChange={jest.fn()}
          localStore={testLocalStore()}
        />
      );
      // A bit of overlap with tests for `loadStatus` directly---it'd be
      // nicer to spy on `loadStatus`, but that's at module top level,
      // so `RepositorySelect` closes over it directly.
      expect(fetch).toHaveBeenCalledWith("/my/gateway" + REPO_ID_REGISTRY_API);
    });

    it("initially renders a LocalStoreRepositorySelect with status LOADING", () => {
      mockRegistry([makeRepoId("irrelevant", "unused")]);
      const e = shallow(
        <RepositorySelect
          assets={assets}
          onChange={jest.fn()}
          localStore={testLocalStore()}
        />
      );
      const child = e.find(LocalStoreRepositorySelect);
      const status = child.props().status;
      const onChange = jest.fn();
      expect(status).toEqual({type: "LOADING"});
      const grandChild = child.props().children({status, onChange});
      expect(grandChild.type).toBe(PureRepositorySelect);
    });

    function waitForUpdate(enzymeWrapper) {
      return new Promise((resolve) => {
        setImmediate(() => {
          enzymeWrapper.update();
          resolve();
        });
      });
    }

    it("on successful load, sets the status on the child", async () => {
      const onChange = jest.fn();
      const selectedRepoId = makeRepoId("foo", "bar");
      mockRegistry([selectedRepoId]);
      const e = shallow(
        <RepositorySelect
          assets={assets}
          onChange={onChange}
          localStore={testLocalStore()}
        />
      );
      await waitForUpdate(e);
      const childStatus = e.props().status;
      const availableRepoIds = [selectedRepoId];
      expect(childStatus).toEqual({
        type: "VALID",
        selectedRepoId,
        availableRepoIds,
      });
    });

    it("on successful load, passes the status to the onChange", async () => {
      const onChange = jest.fn();
      const repoId = makeRepoId("foo", "bar");
      mockRegistry([repoId]);
      const e = shallow(
        <RepositorySelect
          assets={assets}
          onChange={onChange}
          localStore={testLocalStore()}
        />
      );
      await waitForUpdate(e);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(repoId);
    });

    it("on failed load, onChange not called", async () => {
      const onChange = jest.fn();
      fetch.mockReject(new Error("something bad"));

      const e = shallow(
        <RepositorySelect
          assets={assets}
          onChange={onChange}
          localStore={testLocalStore()}
        />
      );
      await waitForUpdate(e);
      expect(onChange).toHaveBeenCalledTimes(0);
      expect(console.error).toHaveBeenCalledTimes(1);
      // $ExpectFlowError
      console.error = jest.fn();
    });

    it("child onChange triggers parent onChange", () => {
      const onChange = jest.fn();
      const repoId = makeRepoId("foo", "bar");
      mockRegistry([repoId]);
      const e = mount(
        <RepositorySelect
          assets={assets}
          onChange={onChange}
          localStore={testLocalStore()}
        />
      );
      const child = e.find(PureRepositorySelect);
      child.props().onChange(repoId);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith(repoId);
    });

    it("selecting child option updates top-level state", async () => {
      const onChange = jest.fn();
      const repoIds = [makeRepoId("foo", "bar"), makeRepoId("z", "a")];
      mockRegistry(repoIds);
      const e = mount(
        <RepositorySelect
          assets={assets}
          onChange={onChange}
          localStore={testLocalStore()}
        />
      );
      await waitForUpdate(e);
      const child = e.find(PureRepositorySelect);
      child.props().onChange(repoIds[0]);
      const status: Status = e.state().status;
      expect(status.type).toEqual("VALID");
      if (status.type !== "VALID") {
        throw new Error("Impossible");
      }
      expect(status.selectedRepoId).toEqual(repoIds[0]);
    });
  });
});
