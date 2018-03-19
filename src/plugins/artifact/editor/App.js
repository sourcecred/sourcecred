// @flow

import React from "react";
import {StyleSheet, css} from "aphrodite/no-important";

import {ArtifactList} from "./ArtifactList";

type Props = {};
type State = {};

export default class App extends React.Component<Props, State> {
  render() {
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
    const artifacts = [
      createSampleArtifact("Root"),
      createSampleArtifact("Tooling"),
      createSampleArtifact("Tests"),
    ];
    return (
      <div>
        <header className={css(styles.header)}>
          <h1>Artifact editor</h1>
        </header>
        <ArtifactList artifacts={artifacts} />
      </div>
    );
  }
}

const styles = StyleSheet.create({
  header: {
    color: "#f0f",
  },
});
