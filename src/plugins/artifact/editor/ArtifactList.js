// @flow

import React from "react";

import type {Node} from "../../../core/graph";
import type {ArtifactNodePayload} from "../artifactPlugin";

type Props = {
  artifacts: Node<ArtifactNodePayload>[],
  createArtifact: (name: string) => void,
};
type State = {
  artifactInProgressName: string,
};

export class ArtifactList extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = {
      artifactInProgressName: "",
    };
  }

  render() {
    return (
      <div>
        <h2>Artifacts</h2>
        <ul>
          {this.props.artifacts.map((x) => (
            <li key={x.address.id}>{x.payload.name}</li>
          ))}
          <input
            value={this.state.artifactInProgressName}
            onChange={(e) => {
              const value = e.target.value;
              this.setState((state) => ({
                artifactInProgressName: value,
              }));
            }}
          />
        </ul>
        <button
          onClick={() => {
            this.props.createArtifact(this.state.artifactInProgressName);
            this.setState({artifactInProgressName: ""});
          }}
        >
          Add artifact
        </button>
      </div>
    );
  }
}
