// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {OdysseyInstanceVisualizer} from "../plugins/odyssey/InstanceVisualizer";
import {hackathonExample} from "../plugins/odyssey/example";

export default class HomePage extends React.Component<{|+assets: Assets|}> {
  render() {
    return <OdysseyInstanceVisualizer instance={hackathonExample()} />;
  }
}
