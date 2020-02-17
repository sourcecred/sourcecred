// @flow

import React from "react";
import type {Assets} from "../webutil/assets";
import {TimelineExplorer} from "./TimelineExplorer";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {encodeProjectId, type ProjectId} from "../core/project";
import {NodeAddress, EdgeAddress} from "../core/graph";
import {
  type PluginDeclarations,
  type PluginDeclaration,
  fromJSON as pluginsFromJSON,
} from "../analysis/pluginDeclaration";

export type Props = {|
  +assets: Assets,
  +projectId: string,
  +loader: Loader,
|};

export type Loader = (assets: Assets, projectId: string) => Promise<LoadResult>;

export type LoadResult = Loading | LoadSuccess | LoadError;
export type Loading = {|+type: "LOADING"|};
export type LoadSuccess = {|
  +type: "SUCCESS",
  +timelineCred: TimelineCred,
  +pluginDeclarations: PluginDeclarations,
|};
export type LoadError = {|+type: "ERROR", +error: any|};

export type State = {|
  loadResult: LoadResult,
|};
export class TimelineApp extends React.Component<Props, State> {
  state = {loadResult: {type: "LOADING"}};

  componentDidMount() {
    this.load();
  }

  async load() {
    const loadResult = await this.props.loader(
      this.props.assets,
      this.props.projectId
    );
    this.setState({loadResult});
  }

  render() {
    const {loadResult} = this.state;
    switch (loadResult.type) {
      case "LOADING": {
        return (
          <div style={{width: 900, margin: "0 auto"}}>
            <h1>Loading...</h1>
          </div>
        );
      }
      case "ERROR": {
        const {error} = loadResult;
        return (
          <div style={{width: 900, margin: "0 auto"}}>
            <h1>Load Error:</h1>
            <p>
              {error.status}:{error.statusText}
            </p>
          </div>
        );
      }
      case "SUCCESS": {
        const {timelineCred, pluginDeclarations} = loadResult;
        const corePlugin: PluginDeclaration = {
          name: "core",
          nodePrefix: NodeAddress.fromParts(["sourcecred", "core"]),
          edgePrefix: EdgeAddress.fromParts(["sourcecred", "core"]),
          nodeTypes: [
            {
              name: "seed",
              pluralName: "seeds",
              prefix: NodeAddress.fromParts(["sourcecred", "core", "SEED"]),
              defaultWeight: 0,
              description: "seed",
            },
            {
              name: "epoch",
              pluralName: "epochs",
              prefix: NodeAddress.fromParts(["sourcecred", "core", "EPOCH"]),
              defaultWeight: 0,
              description: "epoch",
            },
          ],
          edgeTypes: [
            {
              forwardName: "epoch payout",
              backwardName: "backward epoch payout",
              prefix: EdgeAddress.fromParts([
                "sourcecred",
                "core",
                "fibration",
                "EPOCH_PAYOUT",
              ]),
              defaultWeight: {forwards: 0, backwards: 0},
              description: "epoch payout",
            },
            {
              forwardName: "webbing",
              backwardName: "backward webbing",
              prefix: EdgeAddress.fromParts([
                "sourcecred",
                "core",
                "fibration",
                "EPOCH_WEBBING",
              ]),
              defaultWeight: {forwards: 0, backwards: 0},
              description: "epoch webbing",
            },
          ],
          userTypes: [],
        };
        return (
          <TimelineExplorer
            initialTimelineCred={timelineCred}
            projectId={this.props.projectId}
            pluginDeclarations={[corePlugin, ...pluginDeclarations]}
          />
        );
      }
      default:
        throw new Error(`Unexpected load state: ${(loadResult.type: empty)}`);
    }
  }
}

export async function defaultLoader(
  assets: Assets,
  projectId: ProjectId
): Promise<LoadResult> {
  async function fetchCred(): Promise<TimelineCred> {
    const encodedId = encodeProjectId(projectId);
    const url = assets.resolve(`api/v1/data/projects/${encodedId}/cred.json`);
    const response = await fetch(url);
    if (!response.ok) {
      return Promise.reject(response);
    }
    return TimelineCred.fromJSON(await response.json());
  }

  async function fetchPluginDeclarations(): Promise<PluginDeclarations> {
    const encodedId = encodeProjectId(projectId);
    const url = assets.resolve(
      `api/v1/data/projects/${encodedId}/pluginDeclarations.json`
    );
    const response = await fetch(url);
    if (!response.ok) {
      return Promise.reject(response);
    }
    return pluginsFromJSON(await response.json());
  }

  try {
    const [timelineCred, pluginDeclarations] = await Promise.all([
      fetchCred(),
      fetchPluginDeclarations(),
    ]);
    return {type: "SUCCESS", timelineCred, pluginDeclarations};
  } catch (e) {
    console.error(e);
    return {type: "ERROR", error: e};
  }
}
