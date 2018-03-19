// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import type {Node} from "../../../core/graph";
import {ArtifactList} from "./ArtifactList";
import type {ArtifactNodePayload} from "../artifactPlugin";

type Props = {};
type State = {
  artifacts: Node<ArtifactNodePayload>[],
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
    };
  }

  render() {
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Artifact editor</h1>
        </header>
        <ArtifactList
          artifacts={this.state.artifacts}
          createArtifact={(name) => {
            this.setState((state) => ({
              artifacts: [...state.artifacts, createSampleArtifact(name)],
            }));
          }}
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
