// @flow

import React from "react";
import {Router, browserHistory} from "react-router";

import {createRoutes} from "./routes";

export default class App extends React.Component<{}> {
  render() {
    return <Router history={browserHistory} routes={createRoutes()} />;
  }
}
