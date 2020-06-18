// @flow

import React, {type ComponentType} from "react";

import type {Assets} from "../webutil/assets";
import HomepageExplorer from "./homepageExplorer";

export default function makeProjectPage(
  projectId: string
): ComponentType<{|+assets: Assets|}> {
  return class ProjectPage extends React.Component<{|+assets: Assets|}> {
    render() {
      return (
        <HomepageExplorer assets={this.props.assets} projectId={projectId} />
      );
    }
  };
}
