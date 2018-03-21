// @flow

import React from "react";

import type {Graph} from "../../../core/graph";
import LocalStore from "./LocalStore";
import fetchGithubRepo from "../../github/fetchGithubRepo";
import type {
  NodePayload as GithubNodePayload,
  EdgePayload as GithubEdgePayload,
} from "../../github/githubPlugin";
import {GithubParser} from "../../github/githubPlugin";

type Props = {
  onCreateGraph: (graph: Graph<GithubNodePayload, GithubEdgePayload>) => void,
};
type State = {
  apiToken: string,
  repoOwner: string,
  repoName: string,
};

const SETTINGS_KEY = "GithubGraphFetcher.settings";

export class GithubGraphFetcher extends React.Component<Props, State> {
  constructor() {
    super();
    const defaultState = {
      apiToken: "",
      repoOwner: "",
      repoName: "",
    };
    this.state = LocalStore.get(SETTINGS_KEY, defaultState);
  }

  render() {
    return (
      <div>
        <label>
          API token{" "}
          <input
            value={this.state.apiToken}
            onChange={(e) => {
              const value = e.target.value;
              this.setState((state) => ({
                apiToken: value,
              }));
            }}
          />
        </label>
        <br />
        <label>
          Repository owner{" "}
          <input
            value={this.state.repoOwner}
            onChange={(e) => {
              const value = e.target.value;
              this.setState((state) => ({
                repoOwner: value,
              }));
            }}
          />
        </label>
        <br />
        <label>
          Repository name{" "}
          <input
            value={this.state.repoName}
            onChange={(e) => {
              const value = e.target.value;
              this.setState((state) => ({
                repoName: value,
              }));
            }}
          />
        </label>
        <br />
        <button onClick={() => this.fetchGraph()}>Fetch!</button>
      </div>
    );
  }

  fetchGraph() {
    const {repoOwner, repoName, apiToken} = this.state;
    LocalStore.set(SETTINGS_KEY, {apiToken, repoOwner, repoName});
    fetchGithubRepo(repoOwner, repoName, apiToken)
      .then((json) => {
        const parser = new GithubParser(`${repoOwner}/${repoName}`);
        parser.addData(json.data);
        return Promise.resolve(parser.graph);
      })
      .then((graph) => {
        this.props.onCreateGraph(graph);
      });
  }
}
