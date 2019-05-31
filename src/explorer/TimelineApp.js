// @flow

import React from "react";
import type {Assets} from "../webutil/assets";
import type {RepoId} from "../core/repoId";
import {TimelineExplorer} from "./TimelineExplorer";
import {TimelineCred} from "../analysis/timeline/timelineCred";
import {declaration as githubDeclaration} from "../plugins/github/declaration";
import {DEFAULT_CRED_CONFIG} from "../plugins/defaultCredConfig";

export type Props = {|
  +assets: Assets,
  +repoId: RepoId,
  +loader: Loader,
|};

export type Loader = (assets: Assets, repoId: RepoId) => Promise<LoadResult>;

export type LoadResult = Loading | LoadSuccess | LoadError;
export type Loading = {|+type: "LOADING"|};
export type LoadSuccess = {|
  +type: "SUCCESS",
  +timelineCred: TimelineCred,
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
      this.props.repoId
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
        const {timelineCred} = loadResult;
        return (
          <TimelineExplorer
            initialTimelineCred={timelineCred}
            repoId={this.props.repoId}
            declarations={[githubDeclaration]}
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
  repoId: RepoId
): Promise<LoadResult> {
  async function fetchCred(): Promise<TimelineCred> {
    const url = assets.resolve(
      `api/v1/data/data/${repoId.owner}/${repoId.name}/cred.json`
    );
    const response = await fetch(url);
    if (!response.ok) {
      return Promise.reject(response);
    }
    return TimelineCred.fromJSON(await response.json(), DEFAULT_CRED_CONFIG);
  }

  try {
    const timelineCred = await fetchCred();
    return {type: "SUCCESS", timelineCred};
  } catch (e) {
    console.error(e);
    return {type: "ERROR", error: e};
  }
}
