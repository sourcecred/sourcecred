// @flow

import React from "react";

import OdysseyApp from "../plugins/odyssey/ui/App";
import type {Assets} from "../webutil/assets";

export default class HomePage extends React.Component<{|+assets: Assets|}> {
  render() {
    return <OdysseyApp />;
  }
}
