// @flow

import React from "react";
import {Router} from "react-router";
import type {History /* actually `any` */} from "history";

import {createRoutes} from "./createRoutes";
import {resolveTitleFromPath} from "./routeData";

export default class App extends React.Component<{|+history: History|}> {
  render() {
    return (
      <Router
        history={this.props.history}
        routes={createRoutes()}
        onUpdate={function() {
          const router = this;
          const path: string = router.state.location.pathname;
          document.title = resolveTitleFromPath(path);
        }}
      />
    );
  }
}
