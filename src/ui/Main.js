// @flow

import React from "react";
import {Route, Switch} from "react-router-dom";
import ExplorerApp from "./components/ExplorerApp";
import InitiativesEditor from "./components/InitiativesEditor";

export default class Main extends React.PureComponent<{||}, {||}> {
  render() {
    return (
      <Switch>
        <Route exact path="/" render={(props) => <ExplorerApp {...props} />} />
        <Route
          path="/editor"
          render={(props) => <InitiativesEditor {...props} />}
        />
      </Switch>
    );
  }
}
