// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {TimelineApp, defaultLoader} from "../explorer/TimelineApp";
import type {RepoId} from "../core/repoId";

export default class TimelineExplorer extends React.Component<{|
  +assets: Assets,
  +repoId: RepoId,
|}> {
  render() {
    return (
      <TimelineApp
        assets={this.props.assets}
        repoId={this.props.repoId}
        loader={defaultLoader}
      />
    );
  }
}
