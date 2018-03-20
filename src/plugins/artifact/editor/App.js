// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import "./pluginAdapter";

import type {Graph, Node} from "../../../core/graph";
import type {ArtifactNodePayload} from "../artifactPlugin";
import type {
  NodePayload as GitHubNodePayload,
  EdgePayload as GitHubEdgePayload,
} from "../../github/githubPlugin";
import {ArtifactList} from "./ArtifactList";
import {ContributionList} from "./ContributionList";
import {GitHubGraphFetcher} from "./GitHubGraphFetcher";
import standardAdapterSet from "./standardAdapterSet";

type Props = {};
type State = {
  artifacts: Node<ArtifactNodePayload>[],
  githubGraph: ?Graph<GitHubNodePayload, GitHubEdgePayload>,
};

function createSampleArtifact(name) {
  const id = name.toLowerCase().replace(/[^a-z]/g, "-");
  return {
    address: {
      repositoryName: "sourcecred/devnull",
      pluginName: "sourcecred/artifact-beta",
      id,
    },
    payload: {name},
  };
}

export default class App extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = {
      artifacts: [],
      githubGraph: null,
    };
  }

  render() {
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Artifact editor</h1>
        </header>
        <GitHubGraphFetcher
          onCreateGraph={(githubGraph) => {
            this.setState({githubGraph});
          }}
        />
        <ArtifactList
          artifacts={this.state.artifacts}
          createArtifact={(name) => {
            this.setState((state) => ({
              artifacts: [...state.artifacts, createSampleArtifact(name)],
            }));
          }}
        />
        <ContributionList
          graph={this.state.githubGraph}
          adapters={standardAdapterSet}
        />
      </div>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    color: "#f0f",
  },
});
