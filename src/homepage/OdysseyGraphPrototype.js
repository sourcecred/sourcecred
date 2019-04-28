// @flow

import React from "react";

import type {Assets} from "../webutil/assets";
import {OdysseyInstanceVisualizer} from "../plugins/odyssey/InstanceVisualizer";
import {hackathonExample} from "../plugins/odyssey/example";

export default class OdysseyGraphPrototype extends React.Component<{|
  +assets: Assets,
|}> {
  render() {
    return (
      <div style={{height: 800, width: 1000, display: "flex"}}>
        <OdysseyInstanceVisualizer instance={hackathonExample()} />
      </div>
    );
  }
}
