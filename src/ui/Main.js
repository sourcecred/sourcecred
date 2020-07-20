// @flow

import React from "react";
import {Route, Switch} from "react-router-dom";
import ExplorerApp from "./components/ExplorerApp";
import AdminApp from "./components/AdminApp";

export default class Main extends React.PureComponent<{||}, {||}> {
  render() {
    return (
      <Switch>
        <Route exact path="/" render={(props) => <ExplorerApp {...props} />} />
        <Route path="/admin" render={(props) => <AdminApp {...props} />} />
      </Switch>
    );
  }
}
