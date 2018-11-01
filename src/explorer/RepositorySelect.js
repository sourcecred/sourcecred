// @flow

import React, {type Node} from "react";
import sortBy from "lodash.sortby";
import deepEqual from "lodash.isequal";

import * as NullUtil from "../util/null";
import type {LocalStore} from "../webutil/localStore";
import type {Assets} from "../webutil/assets";

import {fromJSON, REPO_ID_REGISTRY_API} from "./repoIdRegistry";
import {type RepoId, stringToRepoId, repoIdToString} from "../core/repoId";
export const REPO_ID_KEY = "selectedRepository";

export type Status =
  | {|+type: "LOADING"|}
  | {|
      +type: "VALID",
      +availableRepoIds: $ReadOnlyArray<RepoId>,
      +selectedRepoId: RepoId,
    |}
  | {|+type: "NO_REPOS"|}
  | {|+type: "FAILURE"|};

type Props = {|
  +assets: Assets,
  +onChange: (x: RepoId) => void,
  +localStore: LocalStore,
|};
type State = {|status: Status|};
export default class RepositorySelect extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      status: {type: "LOADING"},
    };
  }

  componentDidMount() {
    const {assets, localStore} = this.props;
    loadStatus(assets, localStore).then((status) => {
      this.setState({status});
      if (status.type === "VALID") {
        this.props.onChange(status.selectedRepoId);
      }
    });
  }

  onChange(selectedRepoId: RepoId) {
    const status = this.state.status;
    if (status.type === "VALID") {
      const newStatus = {...status, selectedRepoId};
      this.setState({status: newStatus});
    }
    this.props.onChange(selectedRepoId);
  }

  render() {
    return (
      <LocalStoreRepositorySelect
        onChange={(selectedRepoId) => this.onChange(selectedRepoId)}
        status={this.state.status}
        localStore={this.props.localStore}
      >
        {({status, onChange}) => (
          <PureRepositorySelect onChange={onChange} status={status} />
        )}
      </LocalStoreRepositorySelect>
    );
  }
}

export async function loadStatus(
  assets: Assets,
  localStore: LocalStore
): Promise<Status> {
  try {
    const response = await fetch(assets.resolve(REPO_ID_REGISTRY_API));
    if (response.status === 404) {
      return {type: "NO_REPOS"};
    }
    if (!response.ok) {
      console.error(response);
      return {type: "FAILURE"};
    }
    const json = await response.json();
    const availableRepoIds = fromJSON(json);
    if (availableRepoIds.length === 0) {
      return {type: "NO_REPOS"};
    }
    const localStoreRepoId = localStore.get(REPO_ID_KEY, null);
    const selectedRepoId = NullUtil.orElse(
      availableRepoIds.find((x) => deepEqual(x, localStoreRepoId)),
      availableRepoIds[availableRepoIds.length - 1]
    );
    const sortedRepoIds = sortBy(
      availableRepoIds,
      (r) => r.owner,
      (r) => r.name
    );
    return {type: "VALID", availableRepoIds: sortedRepoIds, selectedRepoId};
  } catch (e) {
    console.error(e);
    return {type: "FAILURE"};
  }
}

export class LocalStoreRepositorySelect extends React.Component<{|
  +status: Status,
  +onChange: (repoId: RepoId) => void,
  +localStore: LocalStore,
  +children: ({
    status: Status,
    onChange: (selectedRepoId: RepoId) => void,
  }) => Node,
|}> {
  render() {
    return this.props.children({
      status: this.props.status,
      onChange: (repoId) => {
        this.props.onChange(repoId);
        this.props.localStore.set(REPO_ID_KEY, repoId);
      },
    });
  }
}

type PureRepositorySelectProps = {|
  +onChange: (x: RepoId) => void,
  +status: Status,
|};
export class PureRepositorySelect extends React.PureComponent<
  PureRepositorySelectProps
> {
  renderSelect(
    availableRepoIds: $ReadOnlyArray<RepoId>,
    selectedRepoId: ?RepoId
  ) {
    return (
      <label>
        <span>Please choose a repository to inspect:</span>{" "}
        {selectedRepoId != null && (
          <select
            value={repoIdToString(selectedRepoId)}
            onChange={(e) => {
              const repoId = stringToRepoId(e.target.value);
              this.props.onChange(repoId);
            }}
          >
            {availableRepoIds.map((repoId) => {
              const repoIdString = repoIdToString(repoId);
              return (
                <option value={repoIdString} key={repoIdString}>
                  {repoIdString}
                </option>
              );
            })}
          </select>
        )}
      </label>
    );
  }

  renderError(text: string) {
    return <span style={{fontWeight: "bold", color: "red"}}>{text}</span>;
  }

  render() {
    const {status} = this.props;
    switch (status.type) {
      case "LOADING":
        // Just show an empty select while we wait.
        return this.renderSelect([], null);
      case "VALID":
        return this.renderSelect(
          status.availableRepoIds,
          status.selectedRepoId
        );
      case "NO_REPOS":
        return this.renderError("Error: No repositories found.");
      case "FAILURE":
        return this.renderError(
          "Error: Unable to load repository registry. " +
            "See console for details."
        );
      default:
        throw new Error((status.type: empty));
    }
  }
}
