// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {AppPage} from "../explorer/legacy/App";

export default class HomepageExplorer extends React.Component<{|
  +assets: Assets,
  +projectId: string,
|}> {
  render() {
    return (
      <AppPage assets={this.props.assets} projectId={this.props.projectId} />
    );
  }
}
