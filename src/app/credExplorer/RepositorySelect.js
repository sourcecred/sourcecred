// @flow

import React from "react";
import sortBy from "lodash.sortby";
import deepEqual from "lodash.isequal";

import * as NullUtil from "../../util/null";
import type {LocalStore} from "../localStore";

export const REPO_REGISTRY_API = "/api/v1/data/repositoryRegistry.json";
export const REPO_KEY = "selectedRepository";

export type Repo = {name: string, owner: string};

type RepositorySelectStatus =
  | {|+type: "LOADING"|}
  | {|
      +type: "VALID",
      +availableRepos: $ReadOnlyArray<Repo>,
      +selectedRepo: Repo,
    |}
  | {|+type: "NO_REPOS"|}
  | {|+type: "FAILURE"|};

function validateRepo(repo: Repo) {
  const validRe = /^[A-Za-z0-9_-]+$/;
  if (!repo.owner.match(validRe)) {
    throw new Error(`Invalid repository owner: ${JSON.stringify(repo.owner)}`);
  }
  if (!repo.name.match(validRe)) {
    throw new Error(`Invalid repository name: ${JSON.stringify(repo.name)}`);
  }
}

function repoStringToRepo(x: string): Repo {
  const pieces = x.split("/");
  if (pieces.length !== 2) {
    throw new Error(`Invalid repo string: ${x}`);
  }

  const repo = {owner: pieces[0], name: pieces[1]};
  validateRepo(repo);
  return repo;
}

export async function loadRepositorySelectStatus(
  localStore: LocalStore
): Promise<RepositorySelectStatus> {
  try {
    const response = await fetch(REPO_REGISTRY_API);
    if (!response || !response.ok) {
      return {type: "FAILURE"};
    }
    const json = await response.json();
    let availableRepos = Object.keys(json).map(repoStringToRepo);
    availableRepos = sortBy(availableRepos, (r) => r.owner, (r) => r.name);
    if (availableRepos.length === 0) {
      return {type: "NO_REPOS"};
    }
    const selectedRepo = (function getLocalStoreRepo() {
      const localStoreRepo = localStore.get(REPO_KEY, null);
      if (availableRepos.find((x) => deepEqual(x, localStoreRepo))) {
        return NullUtil.get(localStoreRepo); // satisfy flow
      }
      return availableRepos[0];
    })();
    return {type: "VALID", availableRepos, selectedRepo};
  } catch (e) {
    console.error(e);
    return {type: "FAILURE"};
  }
}

type RepositorySelectProps = {|
  +onChange: (x: ?Repo) => void,
  +localStore: LocalStore,
|};
type RepositorySelectState = {|status: RepositorySelectStatus|};
export class RepositorySelect extends React.Component<
  RepositorySelectProps,
  RepositorySelectState
> {
  constructor(props: RepositorySelectProps) {
    super(props);
    this.state = {
      status: {type: "LOADING"},
    };
  }

  componentDidMount() {
    loadRepositorySelectStatus(this.props.localStore).then((status) => {
      console.error(status);
      this.setState({status});
      if (status.type === "VALID") {
        this.props.onChange(status.selectedRepo);
      }
    });
  }

  render() {
    const status = this.state.status;
    switch (status.type) {
      case "LOADING":
        // Just show an empty select while we wait.
        return this.renderSelect([], null);
      case "VALID":
        return this.renderSelect(status.availableRepos, status.selectedRepo);
      case "NO_REPOS":
        return this.renderError("Error: No repositories found.");
      case "FAILURE":
        return this.renderError("Error: Unable to load repository registry.");
      default:
        throw new Error((status.type: empty));
    }
  }

  onChange(selectedRepo: Repo) {
    const status: RepositorySelectStatus = this.state.status;
    if (status.type === "VALID") {
      const newStatus = {
        type: "VALID",
        selectedRepo,
        availableRepos: status.availableRepos,
      };
      this.setState({status: newStatus});
    }
    this.props.onChange(selectedRepo);
    // TODO: Set the selectedRepo in LocalStore
  }

  renderSelect(availableRepos: $ReadOnlyArray<Repo>, selectedRepo: ?Repo) {
    return (
      <label>
        <span>Please choose a repository to inspect:</span>{" "}
        {selectedRepo != null && (
          <select
            value={`${selectedRepo.owner}/${selectedRepo.name}`}
            onChange={(e) => {
              const repoString = e.target.value;
              const repo = repoStringToRepo(repoString);
              this.onChange(repo);
            }}
          >
            {availableRepos.map(({owner, name}) => {
              const repoString = `${owner}/${name}`;
              return (
                <option value={repoString} key={repoString}>
                  {repoString}
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
}

type PureRepositorySelectProps = {|
  +onChange: (x: Repo) => void,
  +state: RepositorySelectStatus,
|};
export class PureRepositorySelect extends React.PureComponent<
  PureRepositorySelectProps
> {
  renderSelect(availableRepos: $ReadOnlyArray<Repo>, selectedRepo: ?Repo) {
    return (
      <label>
        <span>Please choose a repository to inspect:</span>{" "}
        {selectedRepo != null && (
          <select
            value={`${selectedRepo.owner}/${selectedRepo.name}`}
            onChange={(e) => {
              const repoString = e.target.value;
              const repo = repoStringToRepo(repoString);
              this.props.onChange(repo);
            }}
          >
            {availableRepos.map(({owner, name}) => {
              const repoString = `${owner}/${name}`;
              return (
                <option value={repoString} key={repoString}>
                  {repoString}
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
    const {onChange, state} = this.props;
    switch (state.type) {
      case "LOADING":
        // Just show an empty select while we wait.
        return this.renderSelect([], null);
      case "VALID":
        return this.renderSelect(state.availableRepos, state.selectedRepo);
      case "NO_REPOS":
        return this.renderError("Error: No repositories found.");
      case "FAILURE":
        return this.renderError("Error: Unable to load repository registry.");
      default:
        throw new Error((state.type: empty));
    }
  }
}
