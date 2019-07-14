// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {AppPage} from "../explorer/legacy/App";
import type {RepoId} from "../core/repoId";

export default class HomepageExplorer extends React.Component<{|
  +assets: Assets,
  +repoId: RepoId,
|}> {
  render() {
    return <AppPage assets={this.props.assets} repoId={this.props.repoId} />;
  }
}
