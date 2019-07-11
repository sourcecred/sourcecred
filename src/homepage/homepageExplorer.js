// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {StaticExplorerAdapterSet} from "../explorer/legacy/adapters/explorerAdapterSet";
import {StaticExplorerAdapter as GithubAdapter} from "../plugins/github/explorerAdapter";
import {AppPage} from "../explorer/legacy/App";
import type {RepoId} from "../core/repoId";

function homepageStaticAdapters(): StaticExplorerAdapterSet {
  return new StaticExplorerAdapterSet([new GithubAdapter()]);
}

export default class HomepageExplorer extends React.Component<{|
  +assets: Assets,
  +repoId: RepoId,
|}> {
  render() {
    return (
      <AppPage
        assets={this.props.assets}
        repoId={this.props.repoId}
        adapters={homepageStaticAdapters()}
      />
    );
  }
}
