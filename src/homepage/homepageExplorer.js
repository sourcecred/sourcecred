// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {StaticExplorerAdapterSet} from "../explorer/adapters/explorerAdapterSet";
import {StaticExplorerAdapter as GithubAdapter} from "../plugins/github/explorerAdapter";
import {StaticExplorerAdapter as GitAdapter} from "../plugins/git/explorerAdapter";
import {GithubGitGateway} from "../plugins/github/githubGitGateway";
import {AppPage} from "../explorer/App";
import type {RepoId} from "../core/repoId";

function homepageStaticAdapters(): StaticExplorerAdapterSet {
  return new StaticExplorerAdapterSet([
    new GithubAdapter(),
    new GitAdapter(new GithubGitGateway()),
  ]);
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
