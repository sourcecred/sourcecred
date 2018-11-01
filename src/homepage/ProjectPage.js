// @flow

import React, {type ComponentType} from "react";

import type {RepoId} from "../core/repoId";
import type {Assets} from "../webutil/assets";
import HomepageExplorer from "./homepageExplorer";

export default function makeProjectPage(
  repoId: RepoId
): ComponentType<{|+assets: Assets|}> {
  return class ProjectPage extends React.Component<{|+assets: Assets|}> {
    render() {
      return <HomepageExplorer assets={this.props.assets} repoId={repoId} />;
    }
  };
}
