// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {TimelineApp, defaultLoader} from "../explorer/TimelineApp";

export default class TimelineExplorer extends React.Component<{|
  +assets: Assets,
  +projectId: string,
|}> {
  render() {
    return (
      <TimelineApp
        assets={this.props.assets}
        projectId={this.props.projectId}
        loader={defaultLoader}
      />
    );
  }
}
