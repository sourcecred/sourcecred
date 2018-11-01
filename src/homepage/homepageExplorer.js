// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {StaticAdapterSet} from "../explorer/adapters/adapterSet";
import {StaticAppAdapter as GithubAdapter} from "../plugins/github/appAdapter";
import {StaticAppAdapter as GitAdapter} from "../plugins/git/appAdapter";
import {GithubGitGateway} from "../plugins/github/githubGitGateway";
import {AppPage} from "../explorer/App";

function homepageStaticAdapters(): StaticAdapterSet {
  return new StaticAdapterSet([
    new GithubAdapter(),
    new GitAdapter(new GithubGitGateway()),
  ]);
}

export default class HomepageExplorer extends React.Component<{|
  +assets: Assets,
|}> {
  render() {
    return (
      <AppPage assets={this.props.assets} adapters={homepageStaticAdapters()} />
    );
  }
}
