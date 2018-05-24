// @flow

import React from "react";

import type {Node} from "../../../core/graph";
import type {Settings} from "./SettingsConfig";
import type {NodePayload} from "../artifactPlugin";
import {Graph} from "../../../core/graph";
import {artifactAddress} from "../artifactPlugin";

type Props = {
  settings: Settings,
  onChange: (Graph) => void,
};
type State = {
  graph: Graph,
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

  updateArtifactDescription(
    oldArtifactNode: Node<NodePayload>,
    newDescription: string
  ): void {
    this.setState(
      (state) => ({
        graph: state.graph
          .copy()
          .removeNode(oldArtifactNode.address)
          .addNode({
            address: oldArtifactNode.address,
            payload: {
              name: oldArtifactNode.payload.name,
              description: newDescription,
            },
          }),
      }),
      () => {
        this.props.onChange(this.state.graph);
      }
    );
  }

  render() {
    return (
      <div>
        <h2>Artifacts</h2>
        <table>
          <thead>
            <tr>
              <th>Artifact</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            {this.state.graph.nodes().map((x) => (
              <tr key={x.address.id}>
                <td>{x.payload.name}</td>
                <td>
                  <textarea
                    key={`description-${x.address.id}`}
                    value={x.payload.description}
                    onChange={(e) => {
                      this.updateArtifactDescription(x, e.target.value);
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <input
          value={this.state.artifactInProgressName}
          onChange={(e) => {
            const value = e.target.value;
            this.setState({
              artifactInProgressName: value,
            });
          }}
        />
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
