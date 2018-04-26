// @flow

import React from "react";

import type {Graph} from "../../../core/graph";
import type {Settings} from "./SettingsConfig";
import fetchGithubRepo from "../../github/fetchGithubRepo";
import type {
  NodePayload as GithubNodePayload,
  EdgePayload as GithubEdgePayload,
} from "../../github/types";
import {parse} from "../../github/parser";

type Props = {
  settings: Settings,
  onCreateGraph: (graph: Graph<GithubNodePayload, GithubEdgePayload>) => void,
};

export class GithubGraphFetcher extends React.Component<Props> {
  render() {
    const {settings} = this.props;
    const haveSettings =
      !!settings.githubApiToken && !!settings.repoOwner && !!settings.repoName;
    return (
      <button onClick={() => this.fetchGraph()} disabled={!haveSettings}>
        Fetch GitHub graph
      </button>
    );
  }

  fetchGraph() {
    const {repoOwner, repoName, githubApiToken} = this.props.settings;
    fetchGithubRepo(repoOwner, repoName, githubApiToken)
      .then((json) => {
        return Promise.resolve(parse(`${repoOwner}/${repoName}`, json));
      })
      .then((graph) => {
        this.props.onCreateGraph(graph);
      });
  }
}
