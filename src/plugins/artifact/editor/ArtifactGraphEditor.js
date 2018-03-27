// @flow

import React from "react";

import type {Node} from "../../../core/graph";
import type {Settings} from "./SettingsConfig";
import type {NodePayload, EdgePayload} from "../artifactPlugin";
import {Graph} from "../../../core/graph";
import {artifactAddress} from "../artifactPlugin";

type Props = {
  settings: Settings,
  onChange: (Graph<NodePayload, EdgePayload>) => void,
};
type State = {
  graph: Graph<NodePayload, EdgePayload>,
  artifactInProgressName: string,
};

export class ArtifactGraphEditor extends React.Component<Props, State> {
  constructor() {
    super();
    this.state = {
      graph: new Graph(),
      artifactInProgressName: "",
    };
  }

  componentDidMount() {
    this.props.onChange(this.state.graph);
  }

  addArtifact(name: string): void {
    this.setState(
      (state) => {
        const node: Node<NodePayload> = {
          address: artifactAddress(
            state.graph,
            this.props.settings.repoOwner,
            this.props.settings.repoName,
            name
          ),
          payload: {name, description: ""},
        };
        return {graph: state.graph.copy().addNode(node)};
      },
      () => {
        this.props.onChange(this.state.graph);
      }
    );
  }

  render() {
    return (
      <div>
        <h2>Artifacts</h2>
        <ul>
          {this.state.graph
            .getAllNodes()
            .map((x) => <li key={x.address.id}>{x.payload.name}</li>)}
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
            this.addArtifact(this.state.artifactInProgressName);
            this.setState({artifactInProgressName: ""});
          }}
        >
          Add artifact
        </button>
      </div>
    );
  }
}
