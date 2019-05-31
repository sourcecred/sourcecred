// @flow

import React, {type ComponentType} from "react";

import type {RepoId} from "../core/repoId";
import type {Assets} from "../webutil/assets";
import HomepageTimeline from "./homepageTimeline";

export default function makeTimelinePage(
  repoId: RepoId
): ComponentType<{|+assets: Assets|}> {
  return class TimelinePage extends React.Component<{|+assets: Assets|}> {
    render() {
      return <HomepageTimeline assets={this.props.assets} repoId={repoId} />;
    }
  };
}
