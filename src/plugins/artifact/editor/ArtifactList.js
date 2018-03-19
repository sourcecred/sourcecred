// @flow

import React from "react";

import type {Node} from "../../../core/graph";
import type {ArtifactNodePayload} from "../artifactPlugin";

type Props = {
  artifacts: Node<ArtifactNodePayload>[],
};
type State = {};

export class ArtifactList extends React.Component<Props, State> {
  render() {
    return (
      <div>
        <h2>Artifacts</h2>
        <ul>
          {this.props.artifacts.map((x) => (
            <li key={x.address.id}>{x.payload.name}</li>
          ))}
        </ul>
      </div>
    );
  }
}
