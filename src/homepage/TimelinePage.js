// @flow

import React, {type ComponentType} from "react";

import type {Assets} from "../webutil/assets";
import HomepageTimeline from "./homepageTimeline";

export default function makeTimelinePage(
  projectId: string
): ComponentType<{|+assets: Assets|}> {
  return class TimelinePage extends React.Component<{|+assets: Assets|}> {
    render() {
      return (
        <HomepageTimeline assets={this.props.assets} projectId={projectId} />
      );
    }
  };
}
