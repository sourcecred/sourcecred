// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import "./pluginAdapter";

import type {Graph, Node} from "core/graph";
import type {
  NodePayload as GithubNodePayload,
  EdgePayload as GithubEdgePayload,
} from "plugins/github/types";
import type {
  NodePayload as ArtifactNodePayload,
  EdgePayload as ArtifactEdgePayload,
} from "../artifactPlugin";
import type {Settings} from "./SettingsConfig";
import {ArtifactGraphEditor} from "./ArtifactGraphEditor";
import {ContributionList} from "./ContributionList";
import {GithubGraphFetcher} from "./GithubGraphFetcher";
import {SettingsConfig, defaultSettings} from "./SettingsConfig";
import standardAdapterSet from "./standardAdapterSet";

type Props = {};
type State = {
  artifacts: Node<ArtifactNodePayload>[],
  githubGraph: ?Graph<GithubNodePayload, GithubEdgePayload>,
  artifactGraph: ?Graph<ArtifactNodePayload, ArtifactEdgePayload>,
  settings: Settings,
};

export default class App extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = {
      artifacts: [],
      githubGraph: null,
      artifactGraph: null,
      settings: defaultSettings(),
    };
  }

  render() {
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Artifact editor</h1>
        </header>
        <SettingsConfig
          onChange={(settings) => {
            this.setState({settings});
          }}
        />
        <GithubGraphFetcher
          settings={this.state.settings}
          onCreateGraph={(githubGraph) => {
            this.setState({githubGraph});
          }}
        />
        <ArtifactGraphEditor
          settings={this.state.settings}
          onChange={(artifactGraph) => {
            this.setState({artifactGraph});
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
