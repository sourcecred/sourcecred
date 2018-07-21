// @flow

import React from "react";
import {IndexRoute, Route, Router, browserHistory} from "react-router";

import Page from "./Page";
import CredExplorer from "./credExplorer/App";

export default class App extends React.Component<{}> {
  render() {
    return (
      <Router history={browserHistory}>
        <Route path="/" component={Page}>
          <IndexRoute component={CredExplorer} />
        </Route>
      </Router>
    );
  }
}
